use async_graphql::{EmptySubscription, Request, Schema};
use chrono::Duration;
use serde_json::Value;
use task_scheduler_backend::auth::types::Claims;
use task_scheduler_backend::config::Config;
use task_scheduler_backend::graphql::context::Context as GraphQLContext;
use task_scheduler_backend::graphql::dataloaders::{ProjectLoader, UserLoader};
use task_scheduler_backend::graphql::schema::{Mutation, Query};
use task_scheduler_backend::migration_runner::{self, MigrationState};
use uuid::Uuid;

async fn pool() -> sqlx::PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must name the CATALOG-BACKEND-owned database");
    let pool = sqlx::PgPool::connect(&url).await.expect("connect test database");
    let name: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&pool)
        .await
        .expect("read current database");
    assert_eq!(name, "gm_catalog_verify_20260907");
    pool
}

fn context(pool: sqlx::PgPool, user: Option<Uuid>) -> GraphQLContext {
    let auth = user.map(|id| {
        Claims::new(
            id.to_string(),
            format!("{id}@catalog.test"),
            "Catalog".into(),
            Duration::hours(1),
        )
    });
    GraphQLContext::new(
        pool.clone(),
        auth,
        ProjectLoader::new(pool.clone()),
        UserLoader::new(pool.clone()),
        Config::default(),
    )
}

async fn execute(pool: &sqlx::PgPool, user: Option<Uuid>, document: String) -> async_graphql::Response {
    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .finish()
        .execute(Request::new(document).data(context(pool.clone(), user)))
        .await
}

fn json(response: &async_graphql::Response) -> Value {
    serde_json::from_str(&serde_json::to_string(&response.data).unwrap()).unwrap()
}

fn code(response: &async_graphql::Response) -> Option<String> {
    Some(
        response
            .errors
            .first()?
            .extensions
            .as_ref()?
            .get("code")?
            .to_string()
            .trim_matches('\"')
            .to_owned(),
    )
}

fn id(value: &Value, path: &[&str]) -> Uuid {
    let mut value = value;
    for key in path {
        value = key
            .parse::<usize>()
            .ok()
            .map(|index| &value[index])
            .unwrap_or_else(|| &value[key]);
    }
    Uuid::parse_str(value.as_str().unwrap()).unwrap()
}

#[tokio::test]
async fn readiness_rejects_missing_catalog_schema() {
    let pool = pool().await;
    sqlx::query("DROP TABLE project_task_catalog_labels")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        migration_runner::probe_state(&pool).await.unwrap(),
        MigrationState::PartialSchema
    );
}

#[tokio::test]
async fn mounted_project_catalogs_preserve_task_classification_boundaries() {
    let pool = pool().await;
    assert_eq!(
        migration_runner::probe_state(&pool).await.unwrap(),
        MigrationState::Current {
            version: 20_260_907_000_002
        }
    );

    let owner = Uuid::new_v4();
    let outsider = Uuid::new_v4();
    let manager = Uuid::new_v4();
    let member = Uuid::new_v4();
    let guest = Uuid::new_v4();
    for (user_id, email, username) in [
        (owner, "catalog-owner@test.local", "catalog-owner"),
        (outsider, "catalog-outsider@test.local", "catalog-outsider"),
        (manager, "catalog-manager@test.local", "catalog-manager"),
        (member, "catalog-member@test.local", "catalog-member"),
        (guest, "catalog-guest@test.local", "catalog-guest"),
    ] {
        sqlx::query("INSERT INTO users (user_id, email, username) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(email)
            .bind(username)
            .execute(&pool)
            .await
            .unwrap();
    }
    let project = Uuid::new_v4();
    let other_project = Uuid::new_v4();
    for (project_id, name, owner_id) in [
        (project, "Catalog", owner),
        (other_project, "Other catalog", outsider),
    ] {
        sqlx::query("INSERT INTO projects (project_id, name, owner_id) VALUES ($1, $2, $3)")
            .bind(project_id)
            .bind(name)
            .bind(owner_id)
            .execute(&pool)
            .await
            .unwrap();
    }
    for (user_id, role) in [(manager, "manager"), (member, "member"), (guest, "guest")] {
        let member_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO project_members (member_id, resource_member_id, project_id, user_id, display_name, role) \
             VALUES ($1, $1, $2, $3, $4, $5::member_role)",
        )
        .bind(member_id)
        .bind(project)
        .bind(user_id)
        .bind(format!("catalog {role}"))
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }
    for denied_actor in [member, guest] {
        let denied = execute(
            &pool,
            Some(denied_actor),
            format!(
                "mutation {{ create_project_catalog_items(input: {{ project_id: \"{project}\", kind: PROGRESS_TYPE, items: [{{ labels: [{{locale: \"en\", name: \"Denied\"}}] }}] }}) {{ catalog_item_id }} }}"
            ),
        )
        .await;
        assert_eq!(code(&denied), Some("FORBIDDEN".to_owned()));
    }

    let progress = execute(
        &pool,
        Some(manager),
        format!(
            "mutation {{ create_project_catalog_items(input: {{ project_id: \"{project}\", kind: PROGRESS_TYPE, items: [{{ labels: [{{locale: \"en\", name: \"Create\"}}, {{locale: \"vi\", name: \"Tạo\"}}] }}, {{ labels: [{{locale: \"en\", name: \"Review\"}}] }}] }}) {{ catalog_item_id display_order labels {{ locale name }} }} }}"
        ),
    )
    .await;
    assert!(progress.errors.is_empty(), "{:#?}", progress.errors);
    let progress_json = json(&progress);
    let progress_create = id(&progress_json, &["create_project_catalog_items", "0", "catalog_item_id"]);
    let progress_review = id(&progress_json, &["create_project_catalog_items", "1", "catalog_item_id"]);
    assert_eq!(
        progress_json["create_project_catalog_items"][0]["labels"][0]["locale"],
        "en"
    );

    let category = execute(
        &pool,
        Some(owner),
        format!(
            "mutation {{ create_project_catalog_items(input: {{ project_id: \"{project}\", kind: CATEGORY, items: [{{ labels: [{{locale: \"en\", name: \"Feature\"}}] }}] }}) {{ catalog_item_id }} }}"
        ),
    )
    .await;
    assert!(category.errors.is_empty(), "{:#?}", category.errors);
    let category_id = id(&json(&category), &["create_project_catalog_items", "0", "catalog_item_id"]);
    let task_type = execute(
        &pool,
        Some(owner),
        format!(
            "mutation {{ create_project_catalog_items(input: {{ project_id: \"{project}\", kind: TASK_TYPE, items: [{{ labels: [{{locale: \"en\", name: \"Task\"}}] }}] }}) {{ catalog_item_id }} }}"
        ),
    )
    .await;
    assert!(task_type.errors.is_empty(), "{:#?}", task_type.errors);
    let task_type_id = id(&json(&task_type), &["create_project_catalog_items", "0", "catalog_item_id"]);

    let renamed = execute(
        &pool,
        Some(manager),
        format!(
            "mutation {{ update_project_catalog_item(input: {{ catalog_item_id: \"{progress_create}\", labels: [{{locale: \"en\", name: \"Build\"}}, {{locale: \"ja\", name: \"作る\"}}] }}) {{ catalog_item_id labels {{locale name}} }} }}"
        ),
    )
    .await;
    assert!(renamed.errors.is_empty(), "{:#?}", renamed.errors);
    let renamed_json = json(&renamed);
    assert_eq!(id(&renamed_json, &["update_project_catalog_item", "catalog_item_id"]), progress_create);
    assert_eq!(renamed_json["update_project_catalog_item"]["labels"][0]["locale"], "en");

    let reordered = execute(
        &pool,
        Some(manager),
        format!(
            "mutation {{ reorder_project_catalog_items(input: {{ project_id: \"{project}\", kind: PROGRESS_TYPE, ordered_catalog_item_ids: [\"{progress_review}\", \"{progress_create}\"], expected_catalog_item_ids: [\"{progress_create}\", \"{progress_review}\"] }}) {{ catalog_item_id display_order }} }}"
        ),
    )
    .await;
    assert!(reordered.errors.is_empty(), "{:#?}", reordered.errors);
    assert_eq!(id(&json(&reordered), &["reorder_project_catalog_items", "0", "catalog_item_id"]), progress_review);
    let stale = execute(
        &pool,
        Some(owner),
        format!(
            "mutation {{ reorder_project_catalog_items(input: {{ project_id: \"{project}\", kind: PROGRESS_TYPE, ordered_catalog_item_ids: [\"{progress_create}\", \"{progress_review}\"], expected_catalog_item_ids: [\"{progress_create}\", \"{progress_review}\"] }}) {{ catalog_item_id }} }}"
        ),
    )
    .await;
    assert_eq!(code(&stale), Some("CONFLICT".to_owned()));

    let duplicate = execute(
        &pool,
        Some(owner),
        format!(
            "mutation {{ create_project_catalog_items(input: {{ project_id: \"{project}\", kind: CATEGORY, items: [{{labels:[{{locale:\"en\",name:\"Duplicate\"}}]}}, {{labels:[{{locale:\"en\",name:\"Duplicate\"}}]}}] }}) {{ catalog_item_id }} }}"
        ),
    )
    .await;
    assert_eq!(code(&duplicate), Some("BAD_USER_INPUT".to_owned()));

    let created = execute(
        &pool,
        Some(owner),
        format!(
            "mutation {{ create_task(input: {{ project_id: \"{project}\", title: \"classified\", status: TODO, priority: MEDIUM, priority_order: 0, progress_catalog_item_id: \"{progress_review}\", category_catalog_item_id: \"{category_id}\", task_type_catalog_item_id: \"{task_type_id}\" }}) {{ task_id progress_catalog_item_id category_catalog_item_id task_type_catalog_item_id progress_type category type_ }} }}"
        ),
    )
    .await;
    assert!(created.errors.is_empty(), "{:#?}", created.errors);
    let created_json = json(&created);
    let task_id = id(&created_json, &["create_task", "task_id"]);
    assert_eq!(created_json["create_task"]["progress_type"], Value::Null);
    assert_eq!(created_json["create_task"]["category"], Value::Null);
    assert_eq!(created_json["create_task"]["type_"], Value::Null);

    let omitted = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", title: \"still classified\" }}) {{ progress_catalog_item_id category_catalog_item_id task_type_catalog_item_id }} }}"),
    )
    .await;
    assert!(omitted.errors.is_empty(), "{:#?}", omitted.errors);
    assert_eq!(id(&json(&omitted), &["update_task", "progress_catalog_item_id"]), progress_review);
    let cleared = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", progress_catalog_item_id: null }}) {{ progress_catalog_item_id progress_type }} }}"),
    )
    .await;
    assert!(cleared.errors.is_empty(), "{:#?}", cleared.errors);
    assert_eq!(json(&cleared)["update_task"]["progress_catalog_item_id"], Value::Null);

    let incompatible = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", progress_catalog_item_id: \"{category_id}\" }}) {{ task_id }} }}"),
    )
    .await;
    assert_eq!(code(&incompatible), Some("BAD_USER_INPUT".to_owned()));
    let contradictory = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", category_catalog_item_id: \"{category_id}\", category: \"wrong\" }}) {{ task_id }} }}"),
    )
    .await;
    assert_eq!(code(&contradictory), Some("BAD_USER_INPUT".to_owned()));

    let foreign = execute(
        &pool,
        Some(outsider),
        format!(
            "mutation {{ create_project_catalog_items(input: {{ project_id: \"{other_project}\", kind: PROGRESS_TYPE, items: [{{labels:[{{locale:\"en\",name:\"Other\"}}]}}] }}) {{ catalog_item_id }} }}"
        ),
    )
    .await;
    assert!(foreign.errors.is_empty(), "{:#?}", foreign.errors);
    let foreign_id = id(&json(&foreign), &["create_project_catalog_items", "0", "catalog_item_id"]);
    let foreign_update = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", progress_catalog_item_id: \"{foreign_id}\" }}) {{ task_id }} }}"),
    )
    .await;
    assert_eq!(code(&foreign_update), Some("BAD_USER_INPUT".to_owned()));

    let unauthed = execute(
        &pool,
        None,
        format!("query {{ project_catalog_items(project_id: \"{project}\", kind: PROGRESS_TYPE) {{ catalog_item_id }} }}"),
    )
    .await;
    assert_eq!(code(&unauthed), Some("UNAUTHENTICATED".to_owned()));
    let denied = execute(
        &pool,
        Some(outsider),
        format!("query {{ project_catalog_items(project_id: \"{project}\", kind: PROGRESS_TYPE) {{ catalog_item_id }} }}"),
    )
    .await;
    assert_eq!(code(&denied), Some("FORBIDDEN".to_owned()));

    let restore_progress = execute(
        &pool,
        Some(owner),
        format!("mutation {{ update_task(input: {{ task_id: \"{task_id}\", progress_catalog_item_id: \"{progress_review}\" }}) {{ progress_catalog_item_id }} }}"),
    )
    .await;
    assert!(restore_progress.errors.is_empty(), "{:#?}", restore_progress.errors);
    let cloned = execute(
        &pool,
        Some(owner),
        format!("mutation {{ clone_task_subtree(input: {{ source_task_id: \"{task_id}\", selected_descendant_ids: [], quantity: 1 }}) {{ created_task_ids }} }}"),
    )
    .await;
    assert!(cloned.errors.is_empty(), "{:#?}", cloned.errors);
    let clone_id = id(&json(&cloned), &["clone_task_subtree", "created_task_ids", "0"]);
    let copied: (Option<Uuid>, Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "SELECT progress_catalog_item_id, category_catalog_item_id, task_type_catalog_item_id FROM tasks WHERE task_id = $1",
    )
    .bind(clone_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(copied, (Some(progress_review), Some(category_id), Some(task_type_id)));

    let wrong_kind = sqlx::query("UPDATE tasks SET progress_catalog_item_id = $1 WHERE task_id = $2")
        .bind(category_id)
        .bind(task_id)
        .execute(&pool)
        .await;
    assert!(wrong_kind.is_err(), "direct wrong-kind write must fail");
    let wrong_project = sqlx::query("UPDATE tasks SET progress_catalog_item_id = $1 WHERE task_id = $2")
        .bind(foreign_id)
        .bind(task_id)
        .execute(&pool)
        .await;
    assert!(wrong_project.is_err(), "direct foreign-project write must fail");

    let legacy = execute(
        &pool,
        Some(owner),
        format!("mutation {{ create_task(input: {{ project_id: \"{project}\", title: \"legacy only\", status: TODO, priority: MEDIUM, priority_order: 1, type_: \"legacy raw\" }}) {{ task_type_catalog_item_id type_ }} }}"),
    )
    .await;
    assert!(legacy.errors.is_empty(), "{:#?}", legacy.errors);
    assert_eq!(json(&legacy)["create_task"]["task_type_catalog_item_id"], Value::Null);
    assert_eq!(json(&legacy)["create_task"]["type_"], "legacy raw");

    let denied_delete = execute(
        &pool,
        Some(guest),
        format!("mutation {{ delete_project_catalog_item(catalog_item_id: \"{progress_review}\") {{ catalog_item_id }} }}"),
    )
    .await;
    assert_eq!(code(&denied_delete), Some("FORBIDDEN".to_owned()));
    let foreign_delete = execute(
        &pool,
        Some(owner),
        format!("mutation {{ delete_project_catalog_item(catalog_item_id: \"{foreign_id}\") {{ catalog_item_id }} }}"),
    )
    .await;
    assert_eq!(code(&foreign_delete), Some("FORBIDDEN".to_owned()));
    let task_id_text = task_id.to_string();
    for (item_id, expected_kind) in [
        (progress_review, "PROGRESS_TYPE"),
        (category_id, "CATEGORY"),
        (task_type_id, "TASK_TYPE"),
    ] {
        let deleted = execute(
            &pool,
            Some(manager),
            format!(
                "mutation {{ delete_project_catalog_item(catalog_item_id: \"{item_id}\") {{ catalog_item_id kind affected_task_ids }} }}"
            ),
        )
        .await;
        assert!(deleted.errors.is_empty(), "{expected_kind}: {:#?}", deleted.errors);
        let deleted_json = json(&deleted);
        assert_eq!(id(&deleted_json, &["delete_project_catalog_item", "catalog_item_id"]), item_id);
        assert_eq!(deleted_json["delete_project_catalog_item"]["kind"], expected_kind);
        assert!(deleted_json["delete_project_catalog_item"]["affected_task_ids"]
            .as_array()
            .unwrap()
            .iter()
            .any(|id| id.as_str() == Some(task_id_text.as_str())));
        let label_count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM project_task_catalog_labels WHERE catalog_item_id = $1",
        )
        .bind(item_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(label_count, 0, "{expected_kind} labels must be deleted");
    }
    let cleared_slots: (Option<Uuid>, Option<Uuid>, Option<Uuid>, Option<String>, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT progress_catalog_item_id, category_catalog_item_id, task_type_catalog_item_id, progress_type::text, category, type FROM tasks WHERE task_id = $1",
    )
    .bind(task_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(cleared_slots, (None, None, None, None, None, None));
}
