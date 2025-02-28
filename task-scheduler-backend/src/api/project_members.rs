use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use entity::{project_members, project_members::Entity as ProjectMembers, projects::Entity as Projects, users::Entity as Users};
use chrono::Utc;

#[derive(Debug, Deserialize)]
pub struct AddProjectMemberRequest {
    user_id: String,
    role: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectMemberRequest {
    role: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectMemberResponse {
    id: String,
    user_id: String,
    project_id: String,
    role: String,
    created_at: String,
    updated_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects/{project_id}/members")
            .route("", web::post().to(add_project_member))
            .route("/{user_id}", web::put().to(update_project_member))
            .route("/{user_id}", web::delete().to(remove_project_member))
    );
}

async fn add_project_member(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<AddProjectMemberRequest>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid project UUID"),
    };

    let user_id = match Uuid::parse_str(&request.user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid user UUID"),
    };

    // Verify project exists
    match Projects::find_by_id(project_id).one(db.get_ref()).await {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("Project not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    // Verify user exists
    match Users::find_by_id(user_id).one(db.get_ref()).await {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("User not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    // Check if member already exists
    if let Ok(Some(_)) = ProjectMembers::find()
        .filter(project_members::Column::ProjectId.eq(project_id))
        .filter(project_members::Column::UserId.eq(user_id))
        .one(db.get_ref())
        .await 
    {
        return HttpResponse::BadRequest().json("User is already a member of this project");
    }

    let now = Utc::now();
    let member = project_members::ActiveModel {
        project_id: Set(project_id),
        user_id: Set(user_id),
        role: Set(request.role.clone()),
        joined_at: Set(now.into()),
    };

    match member.insert(db.get_ref()).await {
        Ok(member) => {
            let response = ProjectMemberResponse {
                id: format!("{}-{}", member.project_id, member.user_id),
                user_id: member.user_id.to_string(),
                project_id: member.project_id.to_string(),
                role: member.role,
                created_at: member.joined_at.to_rfc3339(),
                updated_at: member.joined_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not add member: {}", e))
        }
    }
}

async fn update_project_member(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<UpdateProjectMemberRequest>,
) -> impl Responder {
    let (project_id, user_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(uid)) => (pid, uid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let member = match ProjectMembers::find()
        .filter(project_members::Column::ProjectId.eq(project_id))
        .filter(project_members::Column::UserId.eq(user_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(m)) => m,
        Ok(None) => return HttpResponse::NotFound().json("Project member not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut member: project_members::ActiveModel = member.into();
    member.role = Set(request.role.clone());

    match member.update(db.get_ref()).await {
        Ok(updated) => {
            let response = ProjectMemberResponse {
                id: format!("{}-{}", updated.project_id, updated.user_id),
                user_id: updated.user_id.to_string(),
                project_id: updated.project_id.to_string(),
                role: updated.role,
                created_at: updated.joined_at.to_rfc3339(),
                updated_at: updated.joined_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update member: {}", e))
        }
    }
}

async fn remove_project_member(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (project_id, user_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(uid)) => (pid, uid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    match ProjectMembers::delete_many()
        .filter(project_members::Column::ProjectId.eq(project_id))
        .filter(project_members::Column::UserId.eq(user_id))
        .exec(db.get_ref())
        .await 
    {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not remove member: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::MockDatabase;

    #[actix_web::test]
    async fn test_add_project_member() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![project_members::Model {
                id: Uuid::new_v4(),
                project_id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                role: "MEMBER".to_string(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }]])
            .into_connection();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db))
                .configure(config)
        ).await;

        let req = test::TestRequest::post()
            .uri("/projects/123e4567-e89b-12d3-a456-426614174000/members")
            .set_json(&AddProjectMemberRequest {
                user_id: "123e4567-e89b-12d3-a456-426614174001".to_string(),
                role: "MEMBER".to_string(),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
