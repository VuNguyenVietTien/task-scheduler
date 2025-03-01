pub mod auth;
pub mod projects;
// pub mod tasks;
// pub mod comments;
// pub mod project_members;
// pub mod task_assignments;
// pub mod attachments;

use actix_web::{web, middleware::Logger};
use crate::auth::middleware::Auth;

pub fn init(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .wrap(Logger::default())
            // Auth routes không cần Auth middleware
            .service(auth::auth_routes())
            // Các routes khác cần Auth middleware
            .service(
                web::scope("")
                    .wrap(Auth)
                    .configure(projects::config)
            )
    );
    // Các route khác sẽ được thêm sau này và cũng sẽ được bảo vệ bởi Auth middleware
    // .service(comments::comment_routes())
    // .service(project_members::project_member_routes())
    // .service(task_assignments::task_assignment_routes())
    // .service(attachments::attachment_routes())
}
