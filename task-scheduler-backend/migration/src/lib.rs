pub use sea_orm_migration::prelude::*;
mod m20250227_000001_create_core_tables;
mod m20250227_000002_create_task_tables;
mod m20250227_000003_create_notification_tables;
mod m20250301_000001_add_project_fields;
mod m20250303_000001_update_project_progress;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20250227_000001_create_core_tables::Migration),
            Box::new(m20250227_000002_create_task_tables::Migration),
            Box::new(m20250227_000003_create_notification_tables::Migration),
            Box::new(m20250301_000001_add_project_fields::Migration),
            Box::new(m20250303_000001_update_project_progress::Migration),
        ]
    }
}

// Re-export for convenience
pub use m20250227_000001_create_core_tables::*;
pub use m20250227_000002_create_task_tables::*;
pub use m20250227_000003_create_notification_tables::*;
pub use m20250301_000001_add_project_fields::*;
pub use m20250303_000001_update_project_progress::*;
