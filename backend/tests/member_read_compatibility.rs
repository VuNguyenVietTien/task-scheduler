//! Real PostgreSQL regressions; run after herdr_flow in the owned compatibility DB.
use async_graphql::{EmptySubscription, Request, Schema};
use chrono::Duration;
use sqlx::PgPool;
use task_scheduler_backend::{
    auth::types::Claims,
    config::Config,
    graphql::{
        context::Context,
        dataloaders::{ProjectLoader, UserLoader},
        resolvers::{MemberMutation, MemberQuery, ProjectMemberMutation, ProjectMemberQuery},
        schema::{Mutation, Query},
        types::MemberRole,
    },
};
use uuid::Uuid;

async fn pool() -> PgPool {
    let p = PgPool::connect(&std::env::var("TEST_DATABASE_URL").expect("isolated DB required"))
        .await
        .unwrap();
    let identity: (String, String) = sqlx::query_as("SELECT current_database(), pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()")
        .fetch_one(&p).await.unwrap();
    assert_eq!(
        identity,
        ("gm_compat_verify_20260907".into(), "gm_tester".into())
    );
    p
}

async fn exec(
    p: &PgPool,
    actor: Option<Uuid>,
    doc: String,
    mount: usize,
) -> async_graphql::Response {
    let ctx = Context::new(
        p.clone(),
        actor.map(|u| {
            Claims::new(
                u.to_string(),
                format!("{u}@compat.test"),
                "compat".into(),
                Duration::hours(1),
            )
        }),
        ProjectLoader::new(p.clone()),
        UserLoader::new(p.clone()),
        Config::default(),
    );
    let request = Request::new(doc).data(ctx);
    match mount {
        0 => {
            Schema::build(Query::default(), Mutation::default(), EmptySubscription)
                .finish()
                .execute(request)
                .await
        }
        1 => {
            Schema::build(
                MemberQuery::default(),
                MemberMutation::default(),
                EmptySubscription,
            )
            .finish()
            .execute(request)
            .await
        }
        _ => {
            Schema::build(
                ProjectMemberQuery::default(),
                ProjectMemberMutation::default(),
                EmptySubscription,
            )
            .finish()
            .execute(request)
            .await
        }
    }
}

async fn user(p: &PgPool) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO users(user_id,email,username) VALUES($1,$2,$1::text)")
        .bind(id)
        .bind(format!("{id}@compat.test"))
        .execute(p)
        .await
        .unwrap();
    id
}

async fn seed(p: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
    let owner = user(p).await;
    let linked = user(p).await;
    let project = Uuid::new_v4();
    let resource = Uuid::new_v4();
    sqlx::query("INSERT INTO projects(project_id,owner_id,name) VALUES($1,$2,'compatibility')")
        .bind(project)
        .bind(owner)
        .execute(p)
        .await
        .unwrap();
    for (id, actor) in [(Uuid::new_v4(), owner), (resource, linked)] {
        sqlx::query("INSERT INTO project_members(member_id,resource_member_id,project_id,user_id,display_name) VALUES($1,$1,$2,$3,'compatibility')")
            .bind(id).bind(project).bind(actor).execute(p).await.unwrap();
    }
    (project, owner, linked, resource)
}

async fn fingerprint(p: &PgPool, project: Uuid) -> String {
    sqlx::query_scalar("SELECT md5(string_agg(row_to_json(m)::text,'' ORDER BY member_id)) FROM project_members m WHERE project_id=$1")
        .bind(project).fetch_one(p).await.unwrap()
}

#[tokio::test]
async fn stored_roles_use_existing_compatibility_on_all_member_mounts() {
    let p = pool().await;
    for (raw, expected) in [
        ("admin", "manager"),
        ("viewer", "guest"),
        ("manager", "manager"),
        ("leader", "leader"),
        ("member", "member"),
        ("guest", "guest"),
    ] {
        let (project, owner, linked, resource) = seed(&p).await;
        sqlx::query("UPDATE project_members SET role=$2::member_role WHERE resource_member_id=$1")
            .bind(resource)
            .bind(raw)
            .execute(&p)
            .await
            .unwrap();
        let before = fingerprint(&p, project).await;
        for mount in 0..3 {
            let r = exec(&p, Some(owner), format!("query{{project_members(project_id:\"{project}\"){{role user{{user_id}}}} project_member(project_id:\"{project}\",user_id:\"{linked}\"){{role}}}}"), mount).await;
            assert!(r.errors.is_empty(), "{raw}/{mount}: {:?}", r.errors);
            let j = r.data.into_json().unwrap();
            assert_eq!(j["project_members"].as_array().unwrap().len(), 1);
            assert_eq!(j["project_members"][0]["role"], expected);
            assert_eq!(
                j["project_members"][0]["user"]["user_id"],
                linked.to_string()
            );
            assert_eq!(j["project_member"]["role"], expected);
        }
        for actor in [owner, linked] {
            let r = exec(&p, Some(actor), format!("query{{project(project_id:\"{project}\"){{project_id member_count user_role members{{role}}}} my_project_role(project_id:\"{project}\") resource_member(resource_member_id:\"{resource}\"){{access_role}}}}"), 0).await;
            assert!(r.errors.is_empty(), "{raw}: {:?}", r.errors);
            let j = r.data.into_json().unwrap();
            assert_eq!(j["project"]["member_count"], 1);
            assert_eq!(j["project"]["members"][0]["role"], expected);
            assert_eq!(j["resource_member"]["access_role"], raw);
            let expected_role = if actor == owner {
                serde_json::Value::Null
            } else {
                expected.into()
            };
            assert_eq!(j["my_project_role"], expected_role);
            assert_eq!(j["project"]["user_role"], expected_role);
        }
        assert_eq!(
            before,
            fingerprint(&p, project).await,
            "reads changed stored roles"
        );
    }
}

#[tokio::test]
async fn unknown_null_and_missing_role_columns_return_errors_without_default_grants() {
    let p = pool().await;
    for raw in [None, Some("unknown"), Some("")] {
        let row = sqlx::query("SELECT $1::text AS role")
            .bind(raw)
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(MemberRole::from_database_row(&row).is_err());
    }
    let row = sqlx::query("SELECT 1 AS not_role")
        .fetch_one(&p)
        .await
        .unwrap();
    assert!(MemberRole::from_database_row(&row).is_err());
}

#[tokio::test]
async fn member_rejections_keep_graphql_codes_and_member_rows_unchanged() {
    let p = pool().await;
    let (project, owner, linked_no_access, resource) = seed(&p).await;
    let outsider = user(&p).await;
    let before = fingerprint(&p, project).await;
    for mount in 0..3 {
        for (actor, code) in [
            (None, "UNAUTHENTICATED"),
            (Some(outsider), "FORBIDDEN"),
            (Some(linked_no_access), "FORBIDDEN"),
        ] {
            for doc in [format!("query{{project_members(project_id:\"{project}\"){{role}}}}"), format!("query{{project_member(project_id:\"{project}\",user_id:\"{linked_no_access}\"){{role}}}}") ] {
                let r = exec(&p, actor, doc, mount).await;
                assert_eq!(r.data, async_graphql::Value::Null);
                assert_eq!(r.errors[0].extensions.as_ref().and_then(|e|e.get("code")), Some(&code.into()));
            }
        }
    }
    let unknown_email = format!("mutation{{link_resource_member_by_email(resource_member_id:\"{resource}\",email:\"{}@absent.compat.test\"){{resource_member_id}}}}", Uuid::new_v4());
    for (actor, doc, code) in [
        (Some(owner), unknown_email.clone(), "NOT_FOUND"),
        (Some(outsider), unknown_email.clone(), "FORBIDDEN"),
        (None, unknown_email, "UNAUTHENTICATED"),
        (Some(owner), format!("mutation{{set_project_member_access(resource_member_id:\"{resource}\"){{access_role}}}}"), "BAD_USER_INPUT"),
        (Some(owner), format!("mutation{{set_project_member_access(resource_member_id:\"{resource}\",role:\"unknown\"){{access_role}}}}"), "BAD_USER_INPUT"),
    ] {
        let r = exec(&p, actor, doc, 0).await;
        assert!(!r.errors.is_empty());
        assert_eq!(r.errors[0].extensions.as_ref().and_then(|e|e.get("code")), Some(&code.into()));
        assert_eq!(before, fingerprint(&p, project).await);
    }
}
