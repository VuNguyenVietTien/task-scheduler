use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use entity::{tasks, tasks::Entity as Tasks, projects::Entity as Projects};
use chrono::Utc;
use serde_json::json;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct CreateTaskRequest {
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    deadline: Option<String>,
    #[allow(dead_code)]
    assignee_ids: Option<Vec<String>>,
    effort_hours: Option<f32>,
    start_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateTaskRequest {
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    deadline: Option<String>,
    #[allow(dead_code)]
    assignee_ids: Option<Vec<String>>,
    effort_hours: Option<f32>,
    start_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskStatusRequest {
    status: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskPriorityRequest {
    priority: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ReorderKanbanRequest {
    #[allow(dead_code)]
    source_status: String,
    destination_status: String,
    task_id: String,
    #[allow(dead_code)]
    new_index: i32,
}

#[derive(Debug, Serialize)]
pub struct TaskResponse {
    id: String,
    title: String,
    description: Option<String>,
    status: String,
    priority: String,
    deadline: Option<String>,
    assignee_ids: Vec<String>,
    effort_hours: Option<f32>,
    start_date: Option<String>,
    created_at: String,
    updated_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects/{project_id}/tasks")
            .route("", web::post().to(create_task))
            .route("/{task_id}", web::put().to(update_task))
            .route("/{task_id}", web::delete().to(delete_task))
            .route("/{task_id}/status", web::put().to(update_task_status))
            .route("/{task_id}/priority", web::put().to(update_task_priority))
            .route("/kanban/reorder", web::put().to(reorder_kanban))
    );
}

async fn create_task(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<CreateTaskRequest>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid project UUID"),
    };

    // Verify project exists
    match Projects::find_by_id(project_id).one(db.get_ref()).await {
        Ok(Some(_)) => (),
        Ok(None) => return HttpResponse::NotFound().json("Project not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    }

    let now = Utc::now();
    let task = tasks::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        title: Set(request.title.clone()),
        description: Set(request.description.clone()),
        status: Set(request.status.clone()),
        priority: Set(request.priority.clone()),
        deadline: Set(request.deadline.clone().map(|d| d.parse().unwrap())),
        effort_hours: Set(request.effort_hours),
        start_date: Set(request.start_date.clone().map(|d| d.parse().unwrap())),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
        ..Default::default()
    };

    match task.insert(db.get_ref()).await {
        Ok(task) => {
            let response = TaskResponse {
                id: task.id.to_string(),
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                deadline: task.deadline.map(|d| d.to_rfc3339()),
                assignee_ids: vec![], // TODO: Implement assignee handling
                effort_hours: task.effort_hours,
                start_date: task.start_date.map(|d| d.to_rfc3339()),
                created_at: task.created_at.to_rfc3339(),
                updated_at: task.updated_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not create task: {}", e))
        }
    }
}

async fn update_task(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<UpdateTaskRequest>,
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let task = match Tasks::find_by_id(task_id)
        .filter(tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref()).await 
    {
        Ok(Some(t)) => t,
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut task: tasks::ActiveModel = task.into();
    
    if let Some(title) = &request.title {
        task.title = Set(title.clone());
    }
    if let Some(description) = &request.description {
        task.description = Set(Some(description.clone()));
    }
    if let Some(status) = &request.status {
        task.status = Set(status.clone());
    }
    if let Some(priority) = &request.priority {
        task.priority = Set(priority.clone());
    }
    if let Some(deadline) = &request.deadline {
        task.deadline = Set(Some(deadline.parse().unwrap()));
    }
    if let Some(effort_hours) = request.effort_hours {
        task.effort_hours = Set(Some(effort_hours));
    }
    if let Some(start_date) = &request.start_date {
        task.start_date = Set(Some(start_date.parse().unwrap()));
    }
    task.updated_at = Set(Utc::now().into());

    match task.update(db.get_ref()).await {
        Ok(updated) => {
            let response = TaskResponse {
                id: updated.id.to_string(),
                title: updated.title,
                description: updated.description,
                status: updated.status,
                priority: updated.priority,
                deadline: updated.deadline.map(|d| d.to_rfc3339()),
                assignee_ids: vec![], // TODO: Implement assignee handling
                effort_hours: updated.effort_hours,
                start_date: updated.start_date.map(|d| d.to_rfc3339()),
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update task: {}", e))
        }
    }
}

async fn delete_task(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    match Tasks::delete_by_id(task_id)
        .filter(tasks::Column::ProjectId.eq(project_id))
        .exec(db.get_ref()).await 
    {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not delete task: {}", e)),
    }
}

async fn update_task_status(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<UpdateTaskStatusRequest>,
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let task = match Tasks::find_by_id(task_id)
        .filter(tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref()).await 
    {
        Ok(Some(t)) => t,
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut task: tasks::ActiveModel = task.into();
    task.status = Set(request.status.clone());
    task.updated_at = Set(Utc::now().into());

    match task.update(db.get_ref()).await {
        Ok(updated) => {
            let response = TaskResponse {
                id: updated.id.to_string(),
                title: updated.title,
                description: updated.description,
                status: updated.status,
                priority: updated.priority,
                deadline: updated.deadline.map(|d| d.to_rfc3339()),
                assignee_ids: vec![], // TODO: Implement assignee handling
                effort_hours: updated.effort_hours,
                start_date: updated.start_date.map(|d| d.to_rfc3339()),
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update task status: {}", e))
        }
    }
}

async fn update_task_priority(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    request: web::Json<UpdateTaskPriorityRequest>,
) -> impl Responder {
    let (project_id, task_id) = match (Uuid::parse_str(&path.0), Uuid::parse_str(&path.1)) {
        (Ok(pid), Ok(tid)) => (pid, tid),
        _ => return HttpResponse::BadRequest().json("Invalid UUID format"),
    };

    let task = match Tasks::find_by_id(task_id)
        .filter(tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref()).await 
    {
        Ok(Some(t)) => t,
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut task: tasks::ActiveModel = task.into();
    task.priority = Set(request.priority.clone());
    task.updated_at = Set(Utc::now().into());

    match task.update(db.get_ref()).await {
        Ok(updated) => {
            let response = TaskResponse {
                id: updated.id.to_string(),
                title: updated.title,
                description: updated.description,
                status: updated.status,
                priority: updated.priority,
                deadline: updated.deadline.map(|d| d.to_rfc3339()),
                assignee_ids: vec![], // TODO: Implement assignee handling
                effort_hours: updated.effort_hours,
                start_date: updated.start_date.map(|d| d.to_rfc3339()),
                created_at: updated.created_at.to_rfc3339(),
                updated_at: updated.updated_at.to_rfc3339(),
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not update task priority: {}", e))
        }
    }
}

async fn reorder_kanban(
    db: web::Data<DatabaseConnection>,
    path: web::Path<String>,
    request: web::Json<ReorderKanbanRequest>,
) -> impl Responder {
    let project_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid project UUID"),
    };

    let task_id = match Uuid::parse_str(&request.task_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json("Invalid task UUID"),
    };

    let task = match Tasks::find_by_id(task_id)
        .filter(tasks::Column::ProjectId.eq(project_id))
        .one(db.get_ref()).await 
    {
        Ok(Some(t)) => t,
        Ok(None) => return HttpResponse::NotFound().json("Task not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    let mut task: tasks::ActiveModel = task.into();
    task.status = Set(request.destination_status.clone());
    // TODO: Implement order handling
    task.updated_at = Set(Utc::now().into());

    match task.update(db.get_ref()).await {
        Ok(_) => HttpResponse::Ok().json(json!({"success": true})),
        Err(e) => {
            HttpResponse::InternalServerError().json(format!("Could not reorder tasks: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::MockDatabase;

    #[actix_web::test]
    async fn test_create_task() {
        let db = MockDatabase::new()
            .append_query_results(vec![
                vec![tasks::Model {
                    id: Uuid::new_v4(),
                    project_id: Uuid::new_v4(),
                    title: "Test Task".to_string(),
                    description: Some("Test Description".to_string()),
                    status: "TODO".to_string(),
                    priority: "HIGH".to_string(),
                    deadline: None,
                    effort_hours: Some(8.0),
                    start_date: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                }]
            ])
            .into_connection();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(db))
                .configure(config)
        ).await;

        let req = test::TestRequest::post()
            .uri("/projects/123e4567-e89b-12d3-a456-426614174000/tasks")
            .set_json(&CreateTaskRequest {
                title: "Test Task".to_string(),
                description: Some("Test Description".to_string()),
                status: "TODO".to_string(),
                priority: "HIGH".to_string(),
                deadline: None,
                assignee_ids: None,
                effort_hours: Some(8.0),
                start_date: None,
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
