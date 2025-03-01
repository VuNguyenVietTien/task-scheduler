use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait};
use entity::{projects, projects::Entity as Projects};
use log::{info, error};
use chrono::{DateTime, Utc};
use validator::Validate;
use serde_json::Value as JsonValue;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateProjectRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    name: String,
    #[validate(length(max = 500, message = "Description must not exceed 500 characters"))]
    description: Option<String>,
    start_date: Option<DateTime<Utc>>,
    due_date: Option<DateTime<Utc>>,
    #[validate(length(min = 1, message = "Status is required"))]
    status: String,
    #[validate(length(min = 1, message = "Priority is required"))]
    priority: String,
    category: Option<String>,
    metadata: Option<JsonValue>,
    #[validate(length(min = 1, message = "Visibility is required"))]
    visibility: String,
    tags: Option<Vec<String>>,
    progress: Option<f32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProjectRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    name: Option<String>,
    #[validate(length(max = 500, message = "Description must not exceed 500 characters"))]
    description: Option<String>,
    start_date: Option<DateTime<Utc>>,
    due_date: Option<DateTime<Utc>>,
    status: Option<String>,
    priority: Option<String>,
    category: Option<String>,
    metadata: Option<JsonValue>,
    visibility: Option<String>,
    tags: Option<Vec<String>>,
    progress: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    id: String,
    name: String,
    description: Option<String>,
    created_by: String,
    created_at: String,
    updated_at: String,
    start_date: Option<String>,
    due_date: Option<String>,
    status: String,
    priority: String,
    category: Option<String>,
    metadata: Option<JsonValue>,
    visibility: String,
    tags: Option<Vec<String>>,
    progress: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthenticatedUser {
    pub id: Uuid,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects")
            .wrap(crate::auth::middleware::Auth)
            .route("", web::get().to(get_projects))
            .route("", web::post().to(create_project))
            .route("/{id}", web::get().to(get_project))
            .route("/{id}", web::put().to(update_project))
            .route("/{id}", web::delete().to(delete_project))
    );
}

async fn get_projects(
    db: web::Data<DatabaseConnection>,
    user: web::ReqData<AuthenticatedUser>
) -> impl Responder {
    info!("[API] GET /projects - Request received from user {}", user.id);
    info!("[API] GET /projects - Starting database query");

    match Projects::find().all(db.get_ref()).await {
        Ok(projects) => {
            let response: Vec<ProjectResponse> = projects
                .into_iter()
                .map(|p| ProjectResponse {
                    id: p.id.to_string(),
                    name: p.name,
                    description: p.description,
                    created_by: p.created_by.to_string(),
                    created_at: p.created_at.to_rfc3339(),
                    updated_at: p.updated_at.to_rfc3339(),
                    start_date: p.start_date.map(|d| d.to_rfc3339()),
                    due_date: p.due_date.map(|d| d.to_rfc3339()),
                    status: p.status,
                    priority: p.priority,
                    category: p.category,
                    metadata: p.metadata,
                    visibility: p.visibility,
                    tags: p.tags,
                    progress: p.progress,
                })
                .collect();
            info!("[API] GET /projects - Successfully fetched {} projects for user {}", 
                response.len(), user.id);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            error!("[API] GET /projects - Database error for user {}: {}", user.id, e);
            HttpResponse::InternalServerError().json(format!("Could not fetch projects: {}", e))
        }
    }
}

async fn get_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
) -> impl Responder {
    info!("[API] GET /projects/{{id}} - Fetching project");
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            info!("[API] GET /projects/{{id}} - Invalid UUID format");
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    match Projects::find_by_id(id).one(db.get_ref()).await {
        Ok(Some(project)) => {
            let response = ProjectResponse {
                id: project.id.to_string(),
                name: project.name,
                description: project.description,
                created_by: project.created_by.to_string(),
                created_at: project.created_at.to_rfc3339(),
                updated_at: project.updated_at.to_rfc3339(),
                start_date: project.start_date.map(|d| d.to_rfc3339()),
                due_date: project.due_date.map(|d| d.to_rfc3339()),
                status: project.status,
                priority: project.priority,
                category: project.category,
                metadata: project.metadata,
                visibility: project.visibility,
                tags: project.tags,
                progress: project.progress,
            };
            info!("[API] GET /projects/{{id}} - Successfully fetched project {}", id);
            HttpResponse::Ok().json(response)
        }
        Ok(None) => {
            info!("[API] GET /projects/{{id}} - Project {} not found", id);
            HttpResponse::NotFound().json("Project not found")
        }
        Err(e) => {
            info!("[API] GET /projects/{{id}} - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not fetch project: {}", e))
        }
    }
}

async fn create_project(
    db: web::Data<DatabaseConnection>,
    request: web::Json<CreateProjectRequest>,
    user: web::ReqData<AuthenticatedUser>,
) -> impl Responder {
    info!("[API] POST /projects - Creating new project");
    
    if let Err(errors) = request.validate() {
        info!("[API] POST /projects - Validation error: {:?}", errors);
        return HttpResponse::BadRequest().json(format!("Validation error: {:?}", errors));
    }

    let now = Utc::now();
    
    let project = projects::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(request.name.clone()),
        description: Set(request.description.clone()),
        created_by: Set(user.id),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
        start_date: Set(request.start_date.map(|d| d.into())),
        due_date: Set(request.due_date.map(|d| d.into())),
        status: Set(request.status.clone()),
        priority: Set(request.priority.clone()),
        category: Set(request.category.clone()),
        metadata: Set(request.metadata.clone()),
        visibility: Set(request.visibility.clone()),
        tags: Set(request.tags.clone()),
        progress: Set(request.progress.unwrap_or(0.0)),
    };

    match project.insert(db.get_ref()).await {
        Ok(project) => {
            let response = ProjectResponse {
                id: project.id.to_string(),
                name: project.name,
                description: project.description,
                created_by: project.created_by.to_string(),
                created_at: project.created_at.to_rfc3339(),
                updated_at: project.updated_at.to_rfc3339(),
                start_date: project.start_date.map(|d| d.to_rfc3339()),
                due_date: project.due_date.map(|d| d.to_rfc3339()),
                status: project.status,
                priority: project.priority,
                category: project.category,
                metadata: project.metadata,
                visibility: project.visibility,
                tags: project.tags,
                progress: project.progress,
            };
            info!("[API] POST /projects - Successfully created project {}", project.id);
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            info!("[API] POST /projects - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not create project: {}", e))
        }
    }
}

async fn update_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<UpdateProjectRequest>,
) -> impl Responder {
    info!("[API] PUT /projects/{{id}} - Updating project");
    
    if let Err(errors) = request.validate() {
        info!("[API] PUT /projects/{{id}} - Validation error: {:?}", errors);
        return HttpResponse::BadRequest().json(format!("Validation error: {:?}", errors));
    }

    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            info!("[API] PUT /projects/{{id}} - Invalid UUID format");
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    let project = match Projects::find_by_id(id).one(db.get_ref()).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            info!("[API] PUT /projects/{{id}} - Project {} not found", id);
            return HttpResponse::NotFound().json("Project not found");
        }
        Err(e) => {
            info!("[API] PUT /projects/{{id}} - Database error: {}", e);
            return HttpResponse::InternalServerError().json(format!("Database error: {}", e));
        }
    };

    let mut project: projects::ActiveModel = project.into();
    
    if let Some(name) = &request.name {
        project.name = Set(name.clone());
    }
    if let Some(description) = &request.description {
        project.description = Set(Some(description.clone()));
    }
    if let Some(start_date) = request.start_date {
        project.start_date = Set(Some(start_date.into()));
    }
    if let Some(due_date) = request.due_date {
        project.due_date = Set(Some(due_date.into()));
    }
    if let Some(status) = &request.status {
        project.status = Set(status.clone());
    }
    if let Some(priority) = &request.priority {
        project.priority = Set(priority.clone());
    }
    if let Some(category) = &request.category {
        project.category = Set(Some(category.clone()));
    }
    if let Some(metadata) = &request.metadata {
        project.metadata = Set(Some(metadata.clone()));
    }
    if let Some(visibility) = &request.visibility {
        project.visibility = Set(visibility.clone());
    }
    if let Some(tags) = &request.tags {
        project.tags = Set(Some(tags.clone()));
    }
    if let Some(progress) = request.progress {
        project.progress = Set(progress);
    }
    project.updated_at = Set(Utc::now().into());

    match project.update(db.get_ref()).await {
        Ok(updated) => {
            let response = ProjectResponse {
                id: updated.id.to_string(),
                name: updated.name,
                description: updated.description,
                created_by: updated.created_by.to_string(),
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
                start_date: updated.start_date.map(|d| d.to_rfc3339()),
                due_date: updated.due_date.map(|d| d.to_rfc3339()),
                status: updated.status,
                priority: updated.priority,
                category: updated.category,
                metadata: updated.metadata,
                visibility: updated.visibility,
                tags: updated.tags,
                progress: updated.progress,
            };
            info!("[API] PUT /projects/{{id}} - Successfully updated project {}", id);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            info!("[API] PUT /projects/{{id}} - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not update project: {}", e))
        }
    }
}

async fn delete_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
) -> impl Responder {
    info!("[API] DELETE /projects/{{id}} - Deleting project");
    
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            info!("[API] DELETE /projects/{{id}} - Invalid UUID format");
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    match Projects::delete_by_id(id).exec(db.get_ref()).await {
        Ok(_) => {
            info!("[API] DELETE /projects/{{id}} - Successfully deleted project {}", id);
            HttpResponse::NoContent().finish()
        }
        Err(e) => {
            info!("[API] DELETE /projects/{{id}} - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not delete project: {}", e))
        }
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
                created_by: Uuid::new_v4(),
                start_date: None,
                due_date: None,
                status: "NEW".to_string(),
                priority: "MEDIUM".to_string(),
                category: None,
                metadata: None,
                visibility: "PUBLIC".to_string(),
                tags: None,
                progress: 0.0,
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
                start_date: None,
                due_date: None,
                status: "NEW".to_string(),
                priority: "MEDIUM".to_string(),
                category: None,
                metadata: None,
                visibility: "PUBLIC".to_string(),
                tags: None,
                progress: Some(0.0),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
