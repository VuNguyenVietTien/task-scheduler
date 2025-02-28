use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use entity::{task_assignments, task_assignments::Entity as TaskAssignments, tasks::Entity as Tasks, users::Entity as Users};
use chrono::Utc;

#[derive(Debug, Deserialize)]
pub struct AssignUserRequest {
    user_id: String,
}

#[derive(Debug, Serialize)]
pub struct TaskAssignmentResponse {
    id: String,
    task_id: String,
    user_id: String,
    created_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects/{project_id}/tasks/{task_id}/assignments")
            .route("", web::post().to(assign_user))
            .route("/{user_id}", web::delete().to(remove_assignment))
    );
}

async fn assign_user(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<AssignUserRequest>,
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let user_id = match Uuid::parse_str(&request.user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid user UUID"),
    };

    // Verify task exists and belongs to project
    match Tasks::find_by_id(task_id)
        .filter(entity::tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    // Verify user exists
    match Users::find_by_id(user_id).one(db.get_ref()).await {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("User not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    // Check if assignment already exists
    if let Ok(Some(_)) = TaskAssignments::find()
        .filter(task_assignments::Column::TaskId.eq(task_id))
        .filter(task_assignments::Column::UserId.eq(user_id))
        .one(db.get_ref())
        .await 
    {
        return HttpResponse::BadRequest().json("User is already assigned to this task");
    }

    let now = Utc::now();
    let assignment = task_assignments::ActiveModel {
        task_id: Set(task_id),
        user_id: Set(user_id),
        assigned_at: Set(now.into()),
        assigned_by: Set(user_id), // Using the same user as assigner
    };

    match assignment.insert(db.get_ref()).await {
        Ok(assignment) => {
            let response = TaskAssignmentResponse {
                id: format!("{}-{}", assignment.task_id, assignment.user_id),
                task_id: assignment.task_id.to_string(),
                user_id: assignment.user_id.to_string(),
                created_at: assignment.assigned_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not assign user: {}", e))
        }
    }
}

async fn remove_assignment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String, String)>,
) -> impl Responder {
    let (project_id, task_id, user_id) = match (
        Uuid::parse_str(&path.0),
        Uuid::parse_str(&path.1),
        Uuid::parse_str(&path.2),
    ) {
        (Ok(pid), Ok(tid), Ok(uid)) => (pid, tid, uid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    // Verify task exists and belongs to project
    match Tasks::find_by_id(task_id)
        .filter(entity::tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    match TaskAssignments::delete_many()
        .filter(task_assignments::Column::TaskId.eq(task_id))
        .filter(task_assignments::Column::UserId.eq(user_id))
        .exec(db.get_ref())
        .await 
    {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not remove assignment: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::MockDatabase;

    #[actix_web::test]
    async fn test_assign_user() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![task_assignments::Model {
                id: Uuid::new_v4(),
                task_id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                created_at: Utc::now(),
            }]])
            .into_connection();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db))
                .configure(config)
        ).await;

        let req = test::TestRequest::post()
            .uri("/projects/123e4567-e89b-12d3-a456-426614174000/tasks/123e4567-e89b-12d3-a456-426614174001/assignments")
            .set_json(&AssignUserRequest {
                user_id: "123e4567-e89b-12d3-a456-426614174002".to_string(),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
