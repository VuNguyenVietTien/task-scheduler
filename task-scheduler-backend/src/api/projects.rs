use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::{PgPool, Row, postgres::PgRow};
use log::{info, error};
use chrono::{DateTime, Utc, NaiveDate};
use validator::Validate;
use crate::auth::{Auth};  // Import Auth từ module auth

#[derive(Debug, sqlx::FromRow)]
struct ProjectRow {
    project_id: Uuid,
    name: String,
    description: Option<String>, 
    owner_id: Uuid,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    status: String,
    icon_url: Option<String>,
    is_public: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>
}

#[derive(Debug, Deserialize, Validate, Serialize)]
pub struct CreateProjectRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProjectRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub icon_url: Option<String>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub status: String,
    pub icon_url: Option<String>,
    pub is_public: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthenticatedUser {
    pub id: String,
}

impl From<PgRow> for ProjectResponse {
    fn from(row: PgRow) -> Self {
        Self {
            project_id: row.get::<Uuid, _>("project_id").to_string(),
            name: row.get("name"),
            description: row.get("description"),
            owner_id: row.get::<Uuid, _>("owner_id").to_string(),
            start_date: row.get("start_date"),
            end_date: row.get("end_date"),
            status: row.get("status"),
            icon_url: row.get("icon_url"),
            is_public: row.get("is_public"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects")
            .wrap(Auth)
            .route("", web::get().to(get_projects))
            .route("/{id}", web::get().to(get_project)) 
            .route("", web::post().to(create_project))
            .route("/{id}", web::put().to(update_project))
            .route("/{id}", web::delete().to(delete_project))
    );
}

async fn create_project(
    pool: web::Data<PgPool>,
    request: web::Json<CreateProjectRequest>,
    user: web::ReqData<AuthenticatedUser>,
) -> impl Responder {
    info!("Creating new project");

    if let Err(errors) = request.validate() {
        error!("Validation error: {:?}", errors);
        return HttpResponse::BadRequest().json(errors.to_string());
    }

    let now = Utc::now();
    let project_id = Uuid::new_v4();
    let owner_id = Uuid::parse_str(&user.id).expect("Invalid user ID");

    let result = sqlx::query(
        "INSERT INTO projects (
            project_id, name, description, owner_id,
            start_date, end_date, status, icon_url,
            is_public, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        RETURNING *"
    )
    .bind(project_id)
    .bind(&request.name)
    .bind(&request.description)
    .bind(owner_id)
    .bind(request.start_date)
    .bind(request.end_date)
    .bind(request.status.as_deref().unwrap_or("active"))
    .bind(&request.icon_url)
    .bind(request.is_public.unwrap_or(false))
    .bind(now)
    .map(ProjectResponse::from)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(project) => {
            info!("Project created successfully");
            HttpResponse::Created().json(project)
        }
        Err(e) => {
            error!("Database error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not create project: {}", e))
        }
    }
}

async fn get_projects(pool: web::Data<PgPool>) -> impl Responder {
    info!("Fetching all projects");

    let result = sqlx::query(
        "SELECT * FROM projects ORDER BY updated_at DESC"
    )
    .map(ProjectResponse::from)
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(projects) => HttpResponse::Ok().json(projects),
        Err(e) => {
            error!("Database error: {}", e);
            HttpResponse::InternalServerError().json(format!("Could not fetch projects: {}", e))
        }
    }
}

async fn get_project(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let result = sqlx::query(
        "SELECT * FROM projects WHERE project_id = $1"
    )
    .bind(project_id)
    .map(ProjectResponse::from)
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(project)) => HttpResponse::Ok().json(project),
        Ok(None) => HttpResponse::NotFound().json("Project not found"),
        Err(e) => HttpResponse::InternalServerError().json(format!("Database error: {}", e))
    }
}

async fn update_project(
    pool: web::Data<PgPool>,
    path: web::Path<String>, 
    request: web::Json<UpdateProjectRequest>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    if let Err(errors) = request.validate() {
        return HttpResponse::BadRequest().json(errors.to_string());
    }

    let now = Utc::now();

    let result = sqlx::query(
        "UPDATE projects SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            start_date = COALESCE($3, start_date),
            end_date = COALESCE($4, end_date),
            status = COALESCE($5, status),
            icon_url = COALESCE($6, icon_url),
            is_public = COALESCE($7, is_public),
            updated_at = $8
        WHERE project_id = $9
        RETURNING *"
    )
    .bind(&request.name)
    .bind(&request.description)
    .bind(request.start_date)
    .bind(request.end_date)
    .bind(&request.status)
    .bind(&request.icon_url)
    .bind(request.is_public)
    .bind(now)
    .bind(project_id)
    .map(ProjectResponse::from)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(project) => HttpResponse::Ok().json(project),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not update project: {}", e))
    }
}

async fn delete_project(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let result = sqlx::query(
        "DELETE FROM projects WHERE project_id = $1"
    )
    .bind(project_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not delete project: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn test_create_project() {
        let db_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://localhost/test_db".to_string());
            
        let pool = PgPool::connect(&db_url)
            .await
            .expect("Failed to connect to database");

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(config)
        ).await;

        let user = AuthenticatedUser {
            id: Uuid::new_v4().to_string()
        };

        let req = test::TestRequest::post()
            .uri("/projects")
            .set_json(&CreateProjectRequest {
                name: "Test Project".to_string(),
                description: Some("Test Description".to_string()),
                start_date: None,
                end_date: None, 
                status: Some("active".to_string()),
                icon_url: None,
                is_public: Some(false),
            })
            .app_data(web::Data::new(user))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
