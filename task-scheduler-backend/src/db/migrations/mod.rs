use sea_orm_migration::prelude::*;

mod m20250227_000001_create_users;
mod m20250227_000002_create_projects;
mod m20250227_000003_create_project_members;
mod m20250227_000004_create_tasks;
mod m20250227_000005_create_task_assignments;
mod m20250227_000006_create_task_dependencies;
mod m20250227_000007_create_comments;
mod m20250227_000008_create_attachments;
mod m20250227_000009_create_notifications;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20250227_000001_create_users::Migration),
            Box::new(m20250227_000002_create_projects::Migration),
            Box::new(m20250227_000003_create_project_members::Migration),
            Box::new(m20250227_000004_create_tasks::Migration),
            Box::new(m20250227_000005_create_task_assignments::Migration),
            Box::new(m20250227_000006_create_task_dependencies::Migration),
            Box::new(m20250227_000007_create_comments::Migration),
            Box::new(m20250227_000008_create_attachments::Migration),
            Box::new(m20250227_000009_create_notifications::Migration),
        ]
    }
}

// Helper function to run migrations
pub async fn run_migrations(db: &SchemaManager<'_>) -> Result<(), DbErr> {
    for migration in Migrator::migrations() {
        migration.up(db).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection};

    async fn setup_test_db() -> DatabaseConnection {
        let db_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/task_scheduler_test".to_string());
            
        Database::connect(&db_url)
            .await
            .expect("Failed to connect to test database")
    }

    #[tokio::test]
    async fn test_migrations() {
        let db = setup_test_db().await;
        let schema_manager = SchemaManager::new(&db);

        run_migrations(&schema_manager)
            .await
            .expect("Failed to run migrations");

        // Check if tables exist
        let has_users = schema_manager
            .has_table("users")
            .await
            .expect("Failed to check users table");

        assert!(has_users, "Users table should exist");
        assert!(schema_manager.has_table("projects").await.unwrap(), "Projects table should exist");
        assert!(schema_manager.has_table("tasks").await.unwrap(), "Tasks table should exist");
    }
}
