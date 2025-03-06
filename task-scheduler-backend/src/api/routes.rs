use actix_web::web;
use crate::api::auth;

/// Configures all application routes
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .configure(auth::config)
    );
}
