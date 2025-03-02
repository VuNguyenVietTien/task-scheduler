pub use sea_orm_migration::prelude::*;

mod m20250227_000001_create_core_tables;
mod m20250227_000002_create_task_tables; 
mod m20250227_000003_create_notification_tables;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20250227_000001_create_core_tables::Migration),
            Box::new(m20250227_000002_create_task_tables::Migration),
            Box::new(m20250227_000003_create_notification_tables::Migration),
        ]
    }
}

// Re-export migrations for use in other crates
pub use m20250227_000001_create_core_tables::*;
pub use m20250227_000002_create_task_tables::*;
pub use m20250227_000003_create_notification_tables::*;
