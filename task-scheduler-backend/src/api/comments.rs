use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use entity::{comments, comments::Entity as Comments, tasks::Entity as Tasks};
use chrono::Utc;

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    content: String,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    id: String,
    task_id: String,
    user_id: String,
    content: String,
    created_at: String,
    updated_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects/{project_id}/tasks/{task_id}/comments")
            .route("", web::post().to(create_comment))
            .route("/{comment_id}", web::put().to(update_comment))
            .route("/{comment_id}", web::delete().to(delete_comment))
    );
}

async fn create_comment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<CreateCommentRequest>,
    user_id: web::ReqData<Uuid>, // Extracted from auth middleware
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
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

    let now = Utc::now();
    let comment = comments::ActiveModel {
        id: Set(Uuid::new_v4()),
        task_id: Set(task_id),
        user_id: Set(*user_id), // From auth middleware
        content: Set(request.content.clone()),
        parent_comment_id: Set(None),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
    };

    match comment.insert(db.get_ref()).await {
        Ok(comment) => {
            let response = CommentResponse {
                id: comment.id.to_string(),
                task_id: comment.task_id.to_string(),
                user_id: comment.user_id.to_string(),
                content: comment.content,
                created_at: comment.created_at.to_rfc3339(),
                updated_at: comment.updated_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not create comment: {}", e))
        }
    }
}

async fn update_comment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String, String)>,
    request: web::Json<UpdateCommentRequest>,
    user_id: web::ReqData<Uuid>, // From auth middleware
) -> impl Responder {
    let (project_id, task_id, comment_id) = match (
        Uuid::parse_str(&path.0),
        Uuid::parse_str(&path.1),
        Uuid::parse_str(&path.2),
    ) {
        (Ok(pid), Ok(tid), Ok(cid)) => (pid, tid, cid),
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

    let comment = match Comments::find_by_id(comment_id)
        .filter(comments::Column::TaskId.eq(task_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(c)) => c,
        Ok(None) => return HttpResponse::NotFound().json("Comment not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    // Verify comment belongs to user
    if comment.user_id != *user_id {
        return HttpResponse::Forbidden().json("Not authorized to update this comment");
    }

    let mut comment: comments::ActiveModel = comment.into();
    comment.content = Set(request.content.clone());
    comment.updated_at = Set(Utc::now().into());

    match comment.update(db.get_ref()).await {
        Ok(updated) => {
            let response = CommentResponse {
                id: updated.id.to_string(),
                task_id: updated.task_id.to_string(),
                user_id: updated.user_id.to_string(),
                content: updated.content,
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update comment: {}", e))
        }
    }
}

async fn delete_comment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String, String)>,
    user_id: web::ReqData<Uuid>, // From auth middleware
) -> impl Responder {
    let (project_id, task_id, comment_id) = match (
        Uuid::parse_str(&path.0),
        Uuid::parse_str(&path.1),
        Uuid::parse_str(&path.2),
    ) {
        (Ok(pid), Ok(tid), Ok(cid)) => (pid, tid, cid),
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

    // Get comment to verify ownership
    let comment = match Comments::find_by_id(comment_id)
        .filter(comments::Column::TaskId.eq(task_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(c)) => c,
        Ok(None) => return HttpResponse::NotFound().json("Comment not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    // Verify comment belongs to user
    if comment.user_id != *user_id {
        return HttpResponse::Forbidden().json("Not authorized to delete this comment");
    }

    match Comments::delete_by_id(comment_id).exec(db.get_ref()).await {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not delete comment: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::MockDatabase;

    #[actix_web::test]
    async fn test_create_comment() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![comments::Model {
                id: Uuid::new_v4(),
                task_id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                content: "Test comment".to_string(),
                parent_comment_id: None,
                created_at: Utc::now().into(),
                updated_at: Utc::now().into(),
            }]])
            .into_connection();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db))
                .configure(config)
        ).await;

        let req = test::TestRequest::post()
            .uri("/projects/123e4567-e89b-12d3-a456-426614174000/tasks/123e4567-e89b-12d3-a456-426614174001/comments")
            .set_json(&CreateCommentRequest {
                content: "Test comment".to_string(),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
