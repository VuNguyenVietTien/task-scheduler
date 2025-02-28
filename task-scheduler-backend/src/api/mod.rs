pub mod auth;
pub mod projects;
// pub mod tasks;
// pub mod comments;
// pub mod project_members;
// pub mod task_assignments;
// pub mod attachments;

use actix_web::web;

pub fn init(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .configure(projects::config)
            .service(auth::auth_routes())
    );
    // Add other routes when implemented
    // .service(tasks::task_routes())
    // .service(comments::comment_routes())
    // .service(project_members::project_member_routes())
    // .service(task_assignments::task_assignment_routes())
    // .service(attachments::attachment_routes())
}
