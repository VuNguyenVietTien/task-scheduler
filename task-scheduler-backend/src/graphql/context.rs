use sqlx::PgPool;
use std::sync::Arc;

use crate::{
    auth::types::Claims,
    config::Config,
    graphql::dataloaders::{ProjectLoader, UserLoader},
    websocket::NotificationBroadcaster,
};

pub struct Context {
    pub db: PgPool,
    pub auth: Option<Claims>,
    pub project_loader: ProjectLoader,
    pub user_loader: UserLoader,
    pub config: Config,
    pub broadcaster: Option<Arc<NotificationBroadcaster>>,
}

impl Context {
    pub fn new(
        db: PgPool,
        auth: Option<Claims>,
        project_loader: ProjectLoader,
        user_loader: UserLoader,
        config: Config,
        broadcaster: Option<Arc<NotificationBroadcaster>>,
    ) -> Self {
        Self {
            db,
            auth,
            project_loader,
            user_loader,
            config,
            broadcaster,
        }
    }
    
    // Add helper methods for accessing context data
    pub fn get_pool(&self) -> &PgPool {
        &self.db
    }
    
    pub fn get_auth(&self) -> Option<&Claims> {
        self.auth.as_ref()
    }
    
    pub fn get_broadcaster(&self) -> Option<&Arc<NotificationBroadcaster>> {
        self.broadcaster.as_ref()
    }
}
