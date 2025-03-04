use sqlx::PgPool;
use std::sync::Arc;
use crate::graphql::dataloaders::{ProjectLoader, UserLoader};

pub struct Context {
    pub db: PgPool,
    pub user_id: Option<String>,
    pub project_loader: Arc<ProjectLoader>,
    pub user_loader: Arc<UserLoader>,
}

impl Context {
    pub fn new(
        db: PgPool,
        user_id: Option<String>,
        project_loader: ProjectLoader,
        user_loader: UserLoader,
    ) -> Self {
        Self {
            db,
            user_id,
            project_loader: Arc::new(project_loader),
            user_loader: Arc::new(user_loader),
        }
    }
}
