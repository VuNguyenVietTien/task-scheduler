pub use sea_orm_migration::prelude::*;

mod m20250227_000001_create_core_tables;
mod m20250227_000002_create_task_tables;
mod m20250227_000003_create_notification_tables;
mod m20250301_000001_add_project_fields;
mod m20250303_000001_update_project_progress;
mod m20250303_000002_update_task_fields;

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
            Box::new(m20250303_000002_update_task_fields::Migration),
        ]
    }
}
