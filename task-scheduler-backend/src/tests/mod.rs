pub mod helpers;
pub mod task_tests;
pub mod project_tests;
pub mod auth_tests;
pub mod email_tests;

use sea_orm::{Database, DatabaseConnection};
use uuid::Uuid;
use crate::config::Config;

// Test helpers module
pub mod helpers {
    use super::*;
    use crate::db::entities::{user, task, project};
    use sea_orm::{ActiveModelTrait, Set};
    use async_graphql::Context;

    pub async fn setup_test_db() -> DatabaseConnection {
        let database_url = "sqlite::memory:";
        let db = Database::connect(database_url)
            .await
            .expect("Failed to create test database");

        // Run migrations
        // migrations::Migrator::up(&db, None).await.unwrap();

        db
    }

    pub async fn create_test_user(db: &DatabaseConnection) -> user::Model {
        let user = user::ActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set("test@example.com".to_string()),
            name: Set("Test User".to_string()),
            password_hash: Set("hash".to_string()),
            role: Set("MEMBER".to_string()),
            work_capacity: Set(1.0),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
        };

        user.insert(db).await.unwrap()
    }

    pub async fn create_test_project(db: &DatabaseConnection, creator_id: Uuid) -> project::Model {
        let project = project::ActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set("Test Project".to_string()),
            description: Set(Some("Test Description".to_string())),
            created_by: Set(creator_id),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
        };

        project.insert(db).await.unwrap()
    }

    pub async fn create_test_task(
        db: &DatabaseConnection,
        project_id: Uuid,
        creator_id: Uuid,
    ) -> task::Model {
        let task = task::ActiveModel {
            id: Set(Uuid::new_v4()),
            project_id: Set(project_id),
            parent_task_id: Set(None),
            title: Set("Test Task".to_string()),
            description: Set(Some("Test Description".to_string())),
            status: Set("BACKLOG".to_string()),
            priority: Set("MEDIUM".to_string()),
            effort_hours: Set(Some(8.0)),
            start_date: Set(None),
            deadline: Set(None),
            created_by: Set(creator_id),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
            metadata: Set(serde_json::json!({})),
        };

        task.insert(db).await.unwrap()
    }

    pub fn create_test_context(db: DatabaseConnection) -> Context<'static> {
        let mut context = Context::new();
        context.insert(db);
        context.insert(Config::default());
        context
    }
}

// Initialize test database
pub async fn init_test_db() -> DatabaseConnection {
    helpers::setup_test_db().await
}
