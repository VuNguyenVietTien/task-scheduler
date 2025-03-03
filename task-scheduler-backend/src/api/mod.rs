pub mod auth;
pub mod projects;
pub mod logging;
// pub mod attachments;

use actix_web::{web, middleware::Logger};
use crate::auth::middleware::Auth;

pub fn init(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .wrap(Logger::default())
            // Auth routes không cần Auth middleware
            .service(auth::auth_routes())
            // Logging routes không cần Auth middleware
            .service(logging::logging_routes())
            // Các routes khác cần Auth middleware
            .service(
                web::scope("")
                    .wrap(Auth)
                    .configure(projects::config) 
            )
    );
}
