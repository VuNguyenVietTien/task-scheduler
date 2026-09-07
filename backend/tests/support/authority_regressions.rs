//! Mounted PostgreSQL authority regressions. No standalone Claims data.
use super::{exec, gql_ctx};
use async_graphql::{EmptySubscription, Request, Schema};
use sqlx::PgPool;
use task_scheduler_backend::graphql::resolvers::{
    project_authz, MemberMutation, MemberQuery, ProjectMemberMutation, ProjectMemberQuery,
};
use uuid::Uuid;

async fn fingerprint(pool: &PgPool, project: Uuid) -> String {
    sqlx::query_scalar("SELECT md5(COALESCE((SELECT string_agg(row_to_json(m)::text, '' ORDER BY member_id) FROM project_members m WHERE project_id=$1),'') || COALESCE((SELECT string_agg(row_to_json(t)::text, '' ORDER BY task_id) FROM tasks t WHERE project_id=$1),''))")
        .bind(project).fetch_one(pool).await.unwrap()
}
async fn reject(pool: &PgPool, actor: Option<Uuid>, project: Uuid, doc: String) {
    let before = fingerprint(pool, project).await;
    let r = exec(pool, actor, doc.clone()).await;
    assert!(!r.errors.is_empty(), "must reject {doc}");
    assert_eq!(
        before,
        fingerprint(pool, project).await,
        "rejection must write nothing: {doc}"
    );
}
async fn ok(pool: &PgPool, actor: Uuid, doc: String) -> serde_json::Value {
    let r = exec(pool, Some(actor), doc.clone()).await;
    assert!(r.errors.is_empty(), "{doc}: {:?}", r.errors);
    r.data.into_json().unwrap()
}
async fn wait_blocked(pool: &PgPool, blocker: i32, count: i64) {
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            let n: i64 = sqlx::query_scalar("WITH RECURSIVE waiting(pid) AS (SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1 = ANY(pg_blocking_pids(pid)) UNION SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid = ANY(pg_blocking_pids(a.pid)) WHERE a.datname=current_database()) SELECT count(*) FROM waiting")
                .bind(blocker).fetch_one(pool).await.unwrap();
            if n >= count { break; }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    }).await.expect("actual PostgreSQL lock wait must be observed, not a sleep-based race");
}

pub async fn run(pool: &PgPool) {
    let project = Uuid::new_v4();
    let owner = Uuid::new_v4();
    let manager = Uuid::new_v4();
    let leader = Uuid::new_v4();
    let admin = Uuid::new_v4();
    let member = Uuid::new_v4();
    let guest = Uuid::new_v4();
    let neutral = Uuid::new_v4();
    let outsider = Uuid::new_v4();
    let link_user = Uuid::new_v4();
    for user in [
        owner, manager, leader, admin, member, guest, neutral, outsider, link_user,
    ] {
        sqlx::query("INSERT INTO users(user_id,email,username) VALUES ($1,$2,$3)")
            .bind(user)
            .bind(format!("{user}@authority.test"))
            .bind(user.to_string())
            .execute(pool)
            .await
            .unwrap();
    }
    sqlx::query("INSERT INTO projects(project_id,name,owner_id) VALUES ($1,'authority',$2)")
        .bind(project)
        .bind(owner)
        .execute(pool)
        .await
        .unwrap();
    let owner_resource = Uuid::new_v4();
    sqlx::query("INSERT INTO project_members(member_id,resource_member_id,project_id,user_id,display_name,role) VALUES ($1,$1,$2,$3,'owner',NULL)")
        .bind(owner_resource).bind(project).bind(owner).execute(pool).await.unwrap();
    // Migrated owner-only project: no invented role and zero access members.
    let r = ok(pool, owner, format!("query {{ project(project_id: \"{project}\") {{ project_id member_count }} projects {{ project_id member_count }} }}")).await;
    assert_eq!(r["project"]["member_count"], 0);
    assert!(r["projects"]
        .as_array()
        .unwrap()
        .iter()
        .any(|p| p["project_id"] == project.to_string() && p["member_count"] == 0));
    assert!(ok(pool, owner, format!("query {{ project_members(project_id: \"{project}\") {{ role }} project_member(project_id: \"{project}\", user_id: \"{owner}\") {{ role }} }}")).await["project_members"].as_array().unwrap().is_empty());

    let mut resources = std::collections::HashMap::new();
    for (user, role) in [
        (manager, Some("manager")),
        (leader, Some("leader")),
        (member, Some("member")),
        (guest, Some("guest")),
        (neutral, None),
    ] {
        let resource = Uuid::new_v4();
        resources.insert(user, resource);
        sqlx::query("INSERT INTO project_members(member_id,resource_member_id,project_id,user_id,display_name,role) VALUES ($1,$1,$2,$3,'authority member',$4::member_role)")
            .bind(resource).bind(project).bind(user).bind(role).execute(pool).await.unwrap();
    }
    // Exercise BOTH duplicate resolver families, plus the actual combined mount.
    for actor in [None, Some(outsider), Some(neutral), Some(owner)] {
        for doc in [format!("query {{ project_members(project_id: \"{project}\") {{ role user {{ email }} }} }}"),format!("query {{ project_member(project_id: \"{project}\", user_id: \"{member}\") {{ role user {{ email }} }} }}")] {
            let a = Schema::build(MemberQuery::default(), MemberMutation::default(), EmptySubscription).finish()
                .execute(Request::new(doc.clone()).data(gql_ctx(pool.clone(),actor))).await;
            let b = Schema::build(ProjectMemberQuery::default(), ProjectMemberMutation::default(), EmptySubscription).finish()
                .execute(Request::new(doc.clone()).data(gql_ctx(pool.clone(),actor))).await;
            let c = exec(pool, actor, doc).await;
            for r in [a,b,c] {
                assert_eq!(r.errors.is_empty(), actor == Some(owner));
                if actor != Some(owner) { assert!(r.data == async_graphql::Value::Null, "denied read leaked data"); }
            }
        }
    }
    // Legacy admin remains a protected target and authorized caller.
    let admin_resource = Uuid::new_v4();
    resources.insert(admin, admin_resource);
    sqlx::query("INSERT INTO project_members(member_id,resource_member_id,project_id,user_id,display_name,role) VALUES ($1,$1,$2,$3,'admin','admin')")
        .bind(admin_resource).bind(project).bind(admin).execute(pool).await.unwrap();
    let task = Uuid::new_v4();
    sqlx::query("INSERT INTO tasks(task_id,project_id,title,created_by,status,priority,priority_order) VALUES ($1,$2,'authority task',$3,'TODO','MEDIUM',1)")
        .bind(task).bind(project).bind(owner).execute(pool).await.unwrap();
    let update = |target| {
        format!("mutation {{ update_project_member(project_id: \"{project}\", user_id: \"{target}\", role: member) {{ role }} }}")
    };
    let remove = |target| {
        format!("mutation {{ remove_project_member(project_id: \"{project}\", user_id: \"{target}\") }}")
    };
    for actor in [owner, manager, leader, admin] {
        for target in [owner, manager, leader, admin, actor] {
            let resource = if target == owner {
                owner_resource
            } else {
                resources[&target]
            };
            for doc in [update(target),remove(target),
                format!("mutation {{ set_project_member_access(resource_member_id: \"{resource}\", role: \"member\") {{ access_role }} }}"),
                format!("mutation {{ update_multiple_members(project_id: \"{project}\", updates: [{{user_id: \"{member}\", role: guest}},{{user_id: \"{target}\", role: member}}]) {{ success_count }} }}"),
                format!("mutation {{ remove_multiple_project_members(project_id: \"{project}\", member_ids: [\"{}\",\"{resource}\"]) {{ success_count }} }}", resources[&member]),
                format!("mutation {{ add_project_member(input: {{project_id: \"{project}\", user_id: \"{target}\", role: member}}) {{ role }} }}"),
                format!("mutation {{ add_project_member_by_email(project_id: \"{project}\", email: \"{target}@authority.test\", role: member) {{ role }} }}")
            ] { reject(pool,Some(actor),project,doc).await; }
        }
        ok(pool, actor, update(member)).await;
        ok(pool,actor,format!("mutation {{ update_multiple_members(project_id: \"{project}\", updates: [{{user_id: \"{member}\", role: guest}}]) {{ success_count }} }}")).await;
        let r=ok(pool,actor,format!("mutation {{ remove_multiple_project_members(project_id: \"{project}\", member_ids: [\"{}\"]) {{ success_count failed_count }} }}",resources[&member])).await;
        assert_eq!(r["remove_multiple_project_members"]["success_count"], 1);
        ok(pool,actor,format!("mutation {{ set_project_member_access(resource_member_id: \"{}\", role: \"member\") {{ access_role }} }}",resources[&member])).await;
    }
    for actor in [
        None,
        Some(outsider),
        Some(neutral),
        Some(guest),
        Some(member),
    ] {
        reject(pool, actor, project, update(guest)).await;
        reject(pool, actor, project, remove(guest)).await;
    }
    let reorder = |expected: &str, rank| {
        format!("mutation {{ reorder_tasks(input: {{project_id: \"{project}\", tasks: [{{task_id: \"{task}\", priority_order: {rank}}}]{expected}}}) {{task_id priority_order}} }}")
    };
    reject(pool, Some(neutral), project, reorder("", 2)).await;
    reject(pool, None, project, reorder("", 2)).await;
    let r = exec(
        pool,
        Some(owner),
        reorder(&format!(", expected_order: [\"{}\"]", Uuid::new_v4()), 2),
    )
    .await;
    assert_eq!(
        r.errors[0].extensions.as_ref().unwrap().get("code"),
        Some(&async_graphql::Value::from("CONFLICT"))
    );
    ok(
        pool,
        owner,
        reorder(&format!(", expected_order: [\"{task}\"]"), 2),
    )
    .await;
    ok(pool, manager, reorder("", 3)).await; // old client shape
    for tasks in [
        "".to_string(),
        format!(
            "{{task_id: \"{task}\",priority_order: 1}},{{task_id: \"{task}\",priority_order: 2}}"
        ),
        format!("{{task_id: \"{task}\",priority_order: -1}}"),
        format!("{{task_id: \"{}\",priority_order: 1}}", Uuid::new_v4()),
    ] {
        reject(pool,Some(owner),project,format!("mutation {{ reorder_tasks(input: {{project_id: \"{project}\",tasks: [{tasks}]}}) {{task_id}} }}")).await;
    }
    eprintln!("AUTHORITY: mounted duplicate reads/owner zero-member/list; protected single+bulk+canonical targets; allowed owner/manager/leader/admin; reorder checks PASS");

    let a = Uuid::new_v4();
    let b = Uuid::new_v4();
    for id in [a, b] {
        sqlx::query("INSERT INTO project_members(member_id,resource_member_id,project_id,display_name) VALUES ($1,$1,$2,'concurrent link')").bind(id).bind(project).execute(pool).await.unwrap();
    }
    let mut fence = pool.begin().await.unwrap();
    project_authz::require_project_write_tx(&mut fence, owner, project)
        .await
        .unwrap();
    let blocker: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
        .fetch_one(&mut *fence)
        .await
        .unwrap();
    let pa = pool.clone();
    let pb = pool.clone();
    let first = tokio::spawn(async move {
        exec(&pa,Some(owner),format!("mutation {{ link_resource_member_user(resource_member_id: \"{a}\",user_id: \"{link_user}\") {{resource_member_id}} }}")).await
    });
    wait_blocked(pool, blocker, 1).await;
    eprintln!("AUTHORITY: first duplicate-link waiter observed");
    let second = tokio::spawn(async move {
        exec(&pb,Some(owner),format!("mutation {{ link_resource_member_by_email(resource_member_id: \"{b}\",email: \"{link_user}@authority.test\") {{resource_member_id}} }}")).await
    });
    wait_blocked(pool, blocker, 2).await;
    fence.commit().await.unwrap();
    let (ra, rb) = (first.await.unwrap(), second.await.unwrap());
    assert_eq!([&ra, &rb].iter().filter(|r| r.errors.is_empty()).count(), 1);
    let loser = [&ra, &rb]
        .into_iter()
        .find(|r| !r.errors.is_empty())
        .unwrap();
    assert_eq!(
        loser.errors[0].extensions.as_ref().unwrap().get("code"),
        Some(&async_graphql::Value::from("CONFLICT"))
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM project_members WHERE project_id=$1 AND user_id=$2"
        )
        .bind(project)
        .bind(link_user)
        .fetch_one(pool)
        .await
        .unwrap(),
        1
    );
    assert_eq!(sqlx::query_scalar::<_,i64>("SELECT count(*) FROM project_members WHERE resource_member_id=ANY($1) AND user_id IS NULL AND role IS NULL").bind(vec![a,b]).fetch_one(pool).await.unwrap(),1);
    eprintln!("AUTHORITY: two observed PostgreSQL project-lock waiters, duplicate ID/email link exactly one success; loser unchanged PASS");

    let group = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO resource_groups(group_id,project_id,name) VALUES ($1,$2,'authority group')",
    )
    .bind(group)
    .bind(project)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO resource_group_members(group_id,resource_member_id) VALUES ($1,$2)")
        .bind(group)
        .bind(resources[&neutral])
        .execute(pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO resource_group_members(group_id,resource_member_id) VALUES ($1,$2)")
        .bind(group)
        .bind(owner_resource)
        .execute(pool)
        .await
        .unwrap();
    for actor in [owner, manager] {
        reject(
            pool,
            Some(actor),
            project,
            format!("mutation {{ add_project_members_by_group(group_id: \"{group}\") }}"),
        )
        .await;
    }
    sqlx::query("DELETE FROM resource_group_members WHERE group_id=$1 AND resource_member_id=$2")
        .bind(group)
        .bind(owner_resource)
        .execute(pool)
        .await
        .unwrap();
    let protected_docs=vec![
        format!("mutation {{ create_resource_member(input: {{project_id: \"{project}\",display_name: \"revoked\"}}) {{resource_member_id}} }}"),
        format!("mutation {{ link_resource_member_user(resource_member_id: \"{b}\",user_id: \"{outsider}\") {{resource_member_id}} }}"),
        format!("mutation {{ link_resource_member_by_email(resource_member_id: \"{b}\",email: \"{outsider}@authority.test\") {{resource_member_id}} }}"),
        format!("mutation {{ set_project_member_access(resource_member_id: \"{}\",role: \"guest\") {{access_role}} }}",resources[&neutral]),
        update(member),remove(member),
        format!("mutation {{ add_project_member(input: {{project_id: \"{project}\",user_id: \"{neutral}\",role: member}}) {{role}} }}"),
        format!("mutation {{ add_project_member_by_email(project_id: \"{project}\",email: \"{neutral}@authority.test\",role: member) {{role}} }}"),
        format!("mutation {{ update_multiple_members(project_id: \"{project}\",updates: [{{user_id: \"{member}\",role: guest}}]) {{success_count}} }}"),
        format!("mutation {{ remove_multiple_project_members(project_id: \"{project}\",member_ids: [\"{}\"]) {{success_count}} }}",resources[&member]),
        format!("mutation {{ create_task(input: {{project_id: \"{project}\",title: \"revoked\",status: TODO,priority: MEDIUM,priority_order: 4}}) {{task_id}} }}"),
        format!("mutation {{ update_task(input: {{task_id: \"{task}\",assignee_resource_member_id: \"{}\"}}) {{task_id}} }}",resources[&neutral]),
        format!("mutation {{ clone_task_subtree(input: {{source_task_id: \"{task}\",selected_descendant_ids: [],quantity: 1}}) {{created_task_ids}} }}"),
        reorder("",4),
        format!("mutation {{ add_project_members_by_group(group_id: \"{group}\") }}"),
    ];
    for (index, doc) in protected_docs.into_iter().enumerate() {
        // Model an administrative revocation under the SAME production gate.
        // Privileged peers are deliberately not revocable via member APIs.
        sqlx::query("UPDATE project_members SET role='manager' WHERE project_id=$1 AND user_id=$2")
            .bind(project)
            .bind(manager)
            .execute(pool)
            .await
            .unwrap();
        let mut revoke = pool.begin().await.unwrap();
        project_authz::require_project_write_tx(&mut revoke, owner, project)
            .await
            .unwrap();
        let blocker: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *revoke)
            .await
            .unwrap();
        let p = pool.clone();
        let pending = tokio::spawn(async move { exec(&p, Some(manager), doc).await });
        wait_blocked(pool, blocker, 1).await;
        sqlx::query("UPDATE project_members SET role=NULL WHERE project_id=$1 AND user_id=$2")
            .bind(project)
            .bind(manager)
            .execute(&mut *revoke)
            .await
            .unwrap();
        revoke.commit().await.unwrap();
        let after_revoke = fingerprint(pool, project).await;
        let result = pending.await.unwrap();
        assert!(
            !result.errors.is_empty(),
            "revoked protected write {index} committed"
        );
        assert_eq!(
            after_revoke,
            fingerprint(pool, project).await,
            "revoked write {index} changed rows"
        );
        eprintln!("AUTHORITY: revoke/write {index}: PostgreSQL blocking observed; post-wait authorization denied; zero writes PASS");
    }
    let child = Uuid::new_v4();
    sqlx::query("INSERT INTO tasks(task_id,project_id,parent_task_id,title,created_by,status,priority,priority_order) VALUES ($1,$2,$3,'reorder child',$4,'TODO','MEDIUM',9)").bind(child).bind(project).bind(task).bind(owner).execute(pool).await.unwrap();
    let pair = |a, b| {
        format!("{{task_id: \"{task}\",priority_order: {a}}},{{task_id: \"{child}\",priority_order: {b}}}")
    };
    reject(pool,Some(owner),project,format!("mutation {{ reorder_tasks(input: {{project_id: \"{project}\",tasks: [{}]}}) {{task_id}} }}",pair(4,4))).await;
    ok(pool,owner,format!("mutation {{ reorder_tasks(input: {{project_id: \"{project}\",tasks: [{}],expected_order: [\"{task}\",\"{child}\"]}}) {{task_id}} }}",pair(8,2))).await;
    reject(pool,Some(owner),project,format!("mutation {{ reorder_tasks(input: {{project_id: \"{project}\",tasks: [{}],expected_order: [\"{task}\",\"{child}\"]}}) {{task_id}} }}",pair(2,8))).await;
    assert_eq!(
        sqlx::query_scalar::<_, Option<Uuid>>("SELECT parent_task_id FROM tasks WHERE task_id=$1")
            .bind(child)
            .fetch_one(pool)
            .await
            .unwrap(),
        Some(task)
    );
    eprintln!("AUTHORITY: group protected-target rollback; multi-row rank uniqueness/stale reorder/hierarchy preservation PASS");
}
