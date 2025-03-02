use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait};
use entity::{projects, projects::Entity as Projects};
use log::{info, error};
use chrono::Utc;
use validator::Validate;
use serde_json::Value as JsonValue;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateProjectRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    pub name: String,
    #[validate(length(max = 500, message = "Description must not exceed 500 characters"))]
    pub description: Option<String>,
    #[validate(length(min = 1, message = "Status is required"))]
    pub status: String,
    #[validate(length(min = 1, message = "Priority is required"))]
    pub priority: String,
    pub category: Option<String>,
    pub metadata: Option<JsonValue>,
    #[validate(length(min = 1, message = "Visibility is required"))]
    pub visibility: String,
    pub tags: Option<Vec<String>>,
    pub progress: Option<f32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProjectRequest {
    #[validate(length(min = 1, max = 100, message = "Name must be between 1 and 100 characters"))]
    pub name: Option<String>,
    #[validate(length(max = 500, message = "Description must not exceed 500 characters"))]
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub category: Option<String>,
    pub metadata: Option<JsonValue>,
    pub visibility: Option<String>,
    pub tags: Option<Vec<String>>,
    pub progress: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    id: String,
    name: String,
    description: Option<String>,
    created_by: String,
    created_at: String,
    updated_at: String,
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
            .route("/{id}", web::get().to(get_project))
            .route("/{id}", web::put().to(update_project))
            .route("/{id}", web::delete().to(delete_project))
            .route("", web::post().to(create_project_supabase))
    );
}

fn convert_tags_to_vec(tags_json: Option<JsonValue>) -> Option<Vec<String>> {
    tags_json.and_then(|v| serde_json::from_value(v).ok())
}

async fn create_project_supabase(
    db: web::Data<DatabaseConnection>,
    request: web::Json<CreateProjectRequest>,
    user: web::ReqData<AuthenticatedUser>,
) -> impl Responder {
    info!("🚀 [API-CALL] POST /createproject - Received request");
    info!("📝 [REQUEST-DETAILS] Project creation payload: {:#?}", request);
    info!("👤 [USER-CONTEXT] Request from user: {}", user.id);
    
    if let Err(errors) = request.validate() {
        info!("❌ [API-ERROR] POST /createproject - Validation error: {:?}", errors);
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
        status: Set(request.status.clone()),
        priority: Set(request.priority.clone()),
        visibility: Set(request.visibility.clone()),
        tags: Set(request.tags.as_ref().map(|t| serde_json::to_value(t).ok()).flatten()),
        progress: Set(request.progress.unwrap_or(0.0)),
        category: Set(request.category.clone()),
        metadata: Set(request.metadata.clone()),
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
                status: project.status,
                priority: project.priority,
                category: project.category,
                metadata: project.metadata,
                visibility: project.visibility,
                tags: convert_tags_to_vec(project.tags),
                progress: project.progress,
            };
            info!("✅ [API-SUCCESS] POST /createproject - Project {} created successfully", project.id);
            info!("📄 [RESPONSE-DETAILS] Project response: {:#?}", response);
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            error!("❌ [API-ERROR] POST /createproject - Database error: {}", e);
            error!("🔍 [ERROR-CONTEXT] Failed to create project with data: {:#?}", request);
            HttpResponse::InternalServerError().json(format!("Could not create project: {}", e))
        }
    }
}

async fn get_projects(
    db: web::Data<DatabaseConnection>,
    user: web::ReqData<AuthenticatedUser>
) -> impl Responder {
    info!("🚀 [API-CALL] GET /projects - Request received");
    info!("👤 [API-USER] Authenticated user ID: {}", user.id);
    info!("📝 [API-PROCESSING] Starting database query...");

    // Log database connection status
    match db.ping().await {
        Ok(_) => info!("✅ [API-DB] Database connection verified"),
        Err(e) => error!("❌ [API-DB] Database connection error: {}", e),
    }

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
                    status: p.status,
                    priority: p.priority,
                    category: p.category,
                    metadata: p.metadata,
                    visibility: p.visibility,
                    tags: convert_tags_to_vec(p.tags),
                    progress: p.progress,
                })
                .collect();
            info!("✅ [API-SUCCESS] GET /projects - Successfully fetched {} projects for user {}", 
                response.len(), user.id);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            error!("❌ [API-ERROR] GET /projects - Database error for user {}: {}", user.id, e);
            HttpResponse::InternalServerError().json(format!("Could not fetch projects: {}", e))
        }
    }
}

async fn get_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    user: web::ReqData<AuthenticatedUser>,
) -> impl Responder {
    let project_id = path.into_inner();
    info!("🚀 [API-CALL] GET /projects/{} - Request received", project_id);
    info!("👤 [API-USER] Request from user: {}", user.id);

    // Log database connection status
    match db.ping().await {
        Ok(_) => info!("✅ [API-DB] Database connection verified"),
        Err(e) => error!("❌ [API-DB] Database connection error: {}", e),
    }

    let id = match Uuid::parse_str(&project_id) {
        Ok(id) => {
            info!("✅ [API-VALIDATION] Valid UUID format: {}", id);
            id
        },
        Err(_) => {
            error!("❌ [API-ERROR] Invalid UUID format: {}", project_id);
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    info!("🔍 [API-DB] Querying database for project {}", id);
    match Projects::find_by_id(id).one(db.get_ref()).await {
        Ok(Some(project)) => {
            info!("✅ [API-DB] Project found in database");
            
            let response = ProjectResponse {
                id: project.id.to_string(),
                name: project.name,
                description: project.description,
                created_by: project.created_by.to_string(),
                created_at: project.created_at.to_rfc3339(),
                updated_at: project.updated_at.to_rfc3339(),
                status: project.status,
                priority: project.priority,
                category: project.category,
                metadata: project.metadata,
                visibility: project.visibility,
                tags: convert_tags_to_vec(project.tags),
                progress: project.progress,
            };
            
            info!("📤 [API-RESPONSE] Successfully fetched project. Details:");
            info!("   - Name: {}", response.name);
            info!("   - Status: {}", response.status);
            info!("   - Created by: {}", response.created_by);
            
            HttpResponse::Ok().json(response)
        }
        Ok(None) => {
            error!("❌ [API-ERROR] Project {} not found in database", id);
            HttpResponse::NotFound().json("Project not found")
        }
        Err(e) => {
            error!("❌ [API-ERROR] Database error while fetching project {}: {}", id, e);
            HttpResponse::InternalServerError().json(format!("Could not fetch project: {}", e))
        }
    }
}

async fn create_project(
    db: web::Data<DatabaseConnection>,
    request: web::Json<CreateProjectRequest>,
    user: web::ReqData<AuthenticatedUser>,
) -> impl Responder {
    info!("🚀 [API-CALL] POST /projects - Creating new project");
    
    if let Err(errors) = request.validate() {
        info!("❌ [API-ERROR] POST /projects - Validation error: {:?}", errors);
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
        status: Set(request.status.clone()),
        priority: Set(request.priority.clone()),
        category: Set(request.category.clone()),
        metadata: Set(request.metadata.clone()),
        visibility: Set(request.visibility.clone()),
        tags: Set(request.tags.as_ref().map(|t| serde_json::to_value(t).ok()).flatten()),
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
                status: project.status,
                priority: project.priority,
                category: project.category,
                metadata: project.metadata,
                visibility: project.visibility,
                tags: convert_tags_to_vec(project.tags),
                progress: project.progress,
            };
            info!("✅ [API-SUCCESS] POST /projects - Successfully created project {}", project.id);
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            error!("❌ [API-ERROR] POST /projects - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not create project: {}", e))
        }
    }
}

async fn update_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<UpdateProjectRequest>,
) -> impl Responder {
    info!("🚀 [API-CALL] PUT /projects/{{id}} - Updating project");
    
    if let Err(errors) = request.validate() {
        info!("❌ [API-ERROR] PUT /projects/{{id}} - Validation error: {:?}", errors);
        return HttpResponse::BadRequest().json(format!("Validation error: {:?}", errors));
    }

    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            info!("❌ [API-ERROR] PUT /projects/{{id}} - Invalid UUID format");
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    let project = match Projects::find_by_id(id).one(db.get_ref()).await {
        Ok(Some(p)) => p,
        Ok(None) => {
            info!("❌ [API-ERROR] PUT /projects/{{id}} - Project {} not found", id);
            return HttpResponse::NotFound().json("Project not found");
        }
        Err(e) => {
            error!("❌ [API-ERROR] PUT /projects/{{id}} - Database error: {}", e);
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
        project.tags = Set(serde_json::to_value(tags).ok());
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
                status: updated.status,
                priority: updated.priority,
                category: updated.category,
                metadata: updated.metadata,
                visibility: updated.visibility,
                tags: convert_tags_to_vec(updated.tags),
                progress: updated.progress,
            };
            info!("✅ [API-SUCCESS] PUT /projects/{{id}} - Successfully updated project {}", id);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            error!("❌ [API-ERROR] PUT /projects/{{id}} - Error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not update project: {}", e))
        }
    }
}

async fn delete_project(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
) -> impl Responder {
    info!("🚀 [API-CALL] DELETE /projects/{{id}} - Deleting project");
    
    let id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            info!("❌ [API-ERROR] DELETE /projects/{{id}} - Invalid UUID format");
            return HttpResponse::BadRequest().json("Invalid UUID format");
        }
    };

    match Projects::delete_by_id(id).exec(db.get_ref()).await {
        Ok(_) => {
            info!("✅ [API-SUCCESS] DELETE /projects/{{id}} - Successfully deleted project {}", id);
            HttpResponse::NoContent().finish()
        }
        Err(e) => {
            error!("❌ [API-ERROR] DELETE /projects/{{id}} - Error: {}", e);
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
                created_at: Utc::now().into(),
                updated_at: Utc::now().into(),
                created_by: Uuid::new_v4(),
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
