use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait};
use entity::{projects, projects::Entity as Projects};
use chrono::Utc;

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    name: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    name: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    id: String,
    name: String,
    description: Option<String>,
    created_at: String,
    updated_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects")
            .route("", web::post().to(create_project))
            .route("/{id}", web::put().to(update_project))
            .route("/{id}", web::delete().to(delete_project))
    );
}

async fn create_project(
    db: web::Data<DatabaseConnection>,
    request: web::Json<CreateProjectRequest>,
) -> impl Responder {
    let now = Utc::now();
    
    let project = projects::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(request.name.clone()),
        description: Set(request.description.clone()),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
        ..Default::default()
    };

    match project.insert(db.get_ref()).await {
        Ok(project) => {
            let response = ProjectResponse {
                id: project.id.to_string(),
                name: project.name,
                description: project.description,
                created_at: project.created_at.to_rfc3339(),
                updated_at: project.updated_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not create project: {}", e))
        }
    }
}

async fn update_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<UpdateProjectRequest>,
) -> impl Responder {
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let project = match Projects::find_by_id(id).one(db.get_ref()).await {
        Ok(Some(p)) => p,
        Ok(None) => return HttpResponse::NotFound().json("Project not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut project: projects::ActiveModel = project.into();
    
    if let Some(name) = &request.name {
        project.name = Set(name.clone());
    }
    if let Some(description) = &request.description {
        project.description = Set(Some(description.clone()));
    }
    project.updated_at = Set(Utc::now().into());

    match project.update(db.get_ref()).await {
        Ok(updated) => {
            let response = ProjectResponse {
                id: updated.id.to_string(),
                name: updated.name,
                description: updated.description,
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update project: {}", e))
        }
    }
}

async fn delete_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
) -> impl Responder {
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    match Projects::delete_by_id(id).exec(db.get_ref()).await {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not delete project: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::MockDatabase;

    #[actix_web::test]
    async fn test_create_project() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![projects::Model {
                id: Uuid::new_v4(),
                name: "Test Project".to_string(),
                description: Some("Test Description".to_string()),
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
            .uri("/projects")
            .set_json(&CreateProjectRequest {
                name: "Test Project".to_string(),
                description: Some("Test Description".to_string()),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
