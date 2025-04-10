use sqlx::PgPool;

use crate::{
    auth::types::Claims,
    config::Config,
    graphql::dataloaders::{ProjectLoader, UserLoader},
};

pub struct Context {
    pub db: PgPool,
    pub auth: Option<Claims>,
    pub project_loader: ProjectLoader,
    pub user_loader: UserLoader,
    pub config: Config,
}

impl Context {
    pub fn new(
        db: PgPool,
        auth: Option<Claims>,
        project_loader: ProjectLoader,
        user_loader: UserLoader,
        config: Config,
    ) -> Self {
        Self {
            db,
            auth,
            project_loader,
            user_loader,
            config,
        }
    }
    
    // Add helper methods for accessing context data
    pub fn get_pool(&self) -> &PgPool {
        &self.db
    }
    
    pub fn get_auth(&self) -> Option<&Claims> {
        self.auth.as_ref()
    }
}
