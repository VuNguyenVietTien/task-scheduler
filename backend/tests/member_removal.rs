use async_graphql::{EmptySubscription, Request, Schema};
use chrono::Duration;
use sqlx::PgPool;
use task_scheduler_backend::{
    auth::types::Claims,
    config::Config,
    graphql::{
        context::Context as GraphQLContext,
        dataloaders::{ProjectLoader, UserLoader},
        schema::{Mutation, Query},
    },
    migration_runner,
};
use uuid::Uuid;

fn context(pool: PgPool, user_id: Uuid) -> GraphQLContext {
    GraphQLContext::new(
        pool.clone(),
        Some(Claims::new(
            user_id.to_string(),
            format!("{user_id}@member-remove.test"),
            "T".into(),
            Duration::hours(1),
        )),
        ProjectLoader::new(pool.clone()),
        UserLoader::new(pool),
        Config::default(),
    )
}

async fn remove(
    pool: &PgPool,
    caller: Uuid,
    project: Uuid,
    member: Uuid,
) -> async_graphql::Response {
    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .finish()
        .execute(
            Request::new(format!(
                "mutation {{ remove_resource_member(project_id: \"{project}\", member_id: \"{member}\") }}"
            ))
            .data(context(pool.clone(), caller)),
        )
        .await
}

async fn add_member(pool: &PgPool, project: Uuid, user: Option<Uuid>, kind: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO project_members \
         (member_id, resource_member_id, project_id, user_id, display_name, role, member_kind) \
         VALUES ($1, $1, $2, $3, $4, CASE WHEN $3::uuid IS NULL THEN NULL ELSE 'member'::member_role END, $5)",
    )
    .bind(id)
    .bind(project)
    .bind(user)
    .bind(format!("member-{id}"))
    .bind(kind)
    .execute(pool)
    .await
    .unwrap();
    id
}

#[tokio::test]
async fn hard_remove_clears_assignments_preserves_work_and_rolls_back_on_failure() {
    let url = std::env::var("TEST_DATABASE_URL").expect("isolated TEST_DATABASE_URL required");
    let pool = PgPool::connect(&url).await.unwrap();
    let database: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(database, "member_remove_0908");
    sqlx::query("DROP SCHEMA public CASCADE")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE SCHEMA public")
        .execute(&pool)
        .await
        .unwrap();
    migration_runner::run(&pool).await.unwrap();

    let owner = Uuid::new_v4();
    let assigned_user = Uuid::new_v4();
    let unassigned_user = Uuid::new_v4();
    let protected_user = Uuid::new_v4();
    let rollback_user = Uuid::new_v4();
    let outsider = Uuid::new_v4();
    for user in [
        owner,
        assigned_user,
        unassigned_user,
        protected_user,
        rollback_user,
        outsider,
    ] {
        sqlx::query("INSERT INTO users(user_id,email,username) VALUES($1,$2,$3)")
            .bind(user)
            .bind(format!("{user}@member-remove.test"))
            .bind(user.to_string())
            .execute(&pool)
            .await
            .unwrap();
    }
    let project = Uuid::new_v4();
    sqlx::query("INSERT INTO projects(project_id,name,owner_id) VALUES($1,'member removal',$2)")
        .bind(project)
        .bind(owner)
        .execute(&pool)
        .await
        .unwrap();
    add_member(&pool, project, Some(owner), "MEMBER").await;
    let assigned = add_member(&pool, project, Some(assigned_user), "MEMBER").await;
    let unassigned = add_member(&pool, project, Some(unassigned_user), "MEMBER").await;
    let protected = add_member(&pool, project, Some(protected_user), "MEMBER").await;
    let rollback_member = add_member(&pool, project, Some(rollback_user), "MEMBER").await;
    let classifier = add_member(&pool, project, None, "GROUP").await;

    let root = Uuid::new_v4();
    let child = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tasks(task_id,project_id,title,description,tags,created_by,status,priority,priority_order,assignee_resource_member_id,assignee_id) \
         VALUES($1,$2,'kept root','kept description','[\"kept\"]'::jsonb,$3,'TODO','MEDIUM',1,$4,$5), \
               ($6,$2,'kept child','child description','[]'::jsonb,$3,'TODO','MEDIUM',2,$4,$5)",
    )
    .bind(root)
    .bind(project)
    .bind(owner)
    .bind(assigned)
    .bind(assigned_user)
    .bind(child)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE tasks SET parent_task_id=$1 WHERE task_id=$2")
        .bind(root)
        .bind(child)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO timesheet_entries(project_id,user_id,task_id,work_date,hours,note) VALUES($1,$2,$3,'2026-09-08',2,'keep history')")
        .bind(project).bind(assigned_user).bind(root).execute(&pool).await.unwrap();

    let group = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO resource_groups(group_id,project_id,name) VALUES($1,$2,'removal group')",
    )
    .bind(group)
    .bind(project)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO resource_group_members(group_id,resource_member_id) VALUES($1,$2)")
        .bind(group)
        .bind(assigned)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO member_capacity_settings(resource_member_id) VALUES($1)")
        .bind(assigned)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO member_capacity_overrides(resource_member_id,override_date,hours) VALUES($1,'2026-09-08',4)")
        .bind(assigned).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO member_days_off(project_id,scope,resource_member_id,start_date,end_date) VALUES($1,'INDIVIDUAL',$2,'2026-09-09','2026-09-09')")
        .bind(project).bind(assigned).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO resource_member_classifications(resource_member_id,classified_by_resource_member_id) VALUES($1,$2)")
        .bind(assigned).bind(classifier).execute(&pool).await.unwrap();

    sqlx::query("ALTER TABLE tasks DISABLE TRIGGER tasks_canonical_assignment_check")
        .execute(&pool)
        .await
        .unwrap();
    let legacy_task = Uuid::new_v4();
    sqlx::query("INSERT INTO tasks(task_id,project_id,title,created_by,status,priority,priority_order,assignee_id) VALUES($1,$2,'legacy mirror',$3,'TODO','MEDIUM',3,$4)")
        .bind(legacy_task).bind(project).bind(owner).bind(assigned_user).execute(&pool).await.unwrap();
    sqlx::query("ALTER TABLE tasks ENABLE TRIGGER tasks_canonical_assignment_check")
        .execute(&pool)
        .await
        .unwrap();

    let kept_before: Vec<(Uuid, Option<Uuid>, String, Option<String>, serde_json::Value)> = sqlx::query_as(
        "SELECT task_id,parent_task_id,title,description,tags FROM tasks WHERE task_id=ANY($1) ORDER BY priority_order",
    )
    .bind(vec![root, child])
    .fetch_all(&pool)
    .await
    .unwrap();
    let response = remove(&pool, owner, project, assigned).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM project_members WHERE member_id=$1")
            .bind(assigned)
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    let cleared: Vec<(Option<Uuid>, Option<Uuid>)> = sqlx::query_as(
        "SELECT assignee_resource_member_id,assignee_id FROM tasks WHERE task_id=ANY($1) ORDER BY priority_order",
    )
    .bind(vec![root, child, legacy_task])
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(cleared, vec![(None, None), (None, None), (None, None)]);
    let kept_after: Vec<(Uuid, Option<Uuid>, String, Option<String>, serde_json::Value)> = sqlx::query_as(
        "SELECT task_id,parent_task_id,title,description,tags FROM tasks WHERE task_id=ANY($1) ORDER BY priority_order",
    )
    .bind(vec![root, child])
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(kept_after, kept_before);
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM timesheet_entries WHERE user_id=$1 AND task_id=$2"
        )
        .bind(assigned_user)
        .bind(root)
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    for table in [
        "resource_group_members",
        "member_capacity_settings",
        "member_capacity_overrides",
        "member_days_off",
        "resource_member_classifications",
    ] {
        let count: i64 = sqlx::query_scalar(&format!(
            "SELECT count(*) FROM {table} WHERE resource_member_id=$1"
        ))
        .bind(assigned)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 0, "{table} dependency remained");
    }

    let response = remove(&pool, owner, project, unassigned).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM project_members WHERE member_id=$1")
            .bind(unassigned)
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );

    let before =
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM project_members WHERE member_id=$1")
            .bind(protected)
            .fetch_one(&pool)
            .await
            .unwrap();
    let response = remove(&pool, outsider, project, protected).await;
    assert!(!response.errors.is_empty());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM project_members WHERE member_id=$1")
            .bind(protected)
            .fetch_one(&pool)
            .await
            .unwrap(),
        before
    );

    let rollback_task = Uuid::new_v4();
    sqlx::query("INSERT INTO tasks(task_id,project_id,title,created_by,status,priority,priority_order,assignee_resource_member_id,assignee_id) VALUES($1,$2,'rollback',$3,'TODO','MEDIUM',4,$4,$5)")
        .bind(rollback_task).bind(project).bind(owner).bind(rollback_member).bind(rollback_user).execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE member_removal_blocker(member_id uuid REFERENCES project_members(member_id) ON DELETE RESTRICT)")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO member_removal_blocker VALUES($1)")
        .bind(rollback_member)
        .execute(&pool)
        .await
        .unwrap();
    let response = remove(&pool, owner, project, rollback_member).await;
    assert!(!response.errors.is_empty());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM project_members WHERE member_id=$1")
            .bind(rollback_member)
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
            "SELECT assignee_resource_member_id,assignee_id FROM tasks WHERE task_id=$1"
        )
        .bind(rollback_task)
        .fetch_one(&pool)
        .await
        .unwrap(),
        (Some(rollback_member), Some(rollback_user))
    );
}
