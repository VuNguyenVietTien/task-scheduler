pub mod entities;
pub mod migrations;

use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::time::Duration;
use crate::{config::Config, error::AppResult};

pub async fn init_db(config: &Config) -> AppResult<DatabaseConnection> {
    let mut opt = ConnectOptions::new(&config.database_url);
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(8))
        .max_lifetime(Duration::from_secs(8))
        .sqlx_logging(true);

    Ok(Database::connect(opt).await?)
}

// Re-export common entity types with proper namespacing
pub use entities::{
    project::{
        ActiveModel as ProjectActiveModel,
        Entity as ProjectEntity,
        Model as ProjectModel,
    },
    task::{
        ActiveModel as TaskActiveModel,
        Entity as TaskEntity,
        Model as TaskModel,
    },
    comment::{
        ActiveModel as CommentActiveModel,
        Entity as CommentEntity,
        Model as CommentModel,
    },
    attachment::{
        ActiveModel as AttachmentActiveModel,
        Entity as AttachmentEntity,
        Model as AttachmentModel,
    },
    notification::{
        ActiveModel as NotificationActiveModel,
        Entity as NotificationEntity,
        Model as NotificationModel,
    },
};

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::DbConn;
    use crate::config::Config;

    async fn create_test_db() -> AppResult<DbConn> {
        let config = Config {
            database_url: "postgres://postgres:postgres@localhost:5432/task_scheduler_test".to_string(),
            ..Default::default()
        };

        init_db(&config).await
    }

    #[tokio::test]
    async fn test_db_connection() -> AppResult<()> {
        let _db = create_test_db().await?;
        Ok(())
    }
}
