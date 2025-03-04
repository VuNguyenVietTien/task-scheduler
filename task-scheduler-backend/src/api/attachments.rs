use actix_web::{web, HttpResponse, Responder};
use actix_multipart::Multipart;
use futures::{StreamExt, TryStreamExt};
use serde::Serialize;
use uuid::Uuid;
use entity::{attachments, attachments::Entity as Attachments, tasks::Entity as Tasks};
use chrono::Utc;
use std::path::Path;
use bytes::BytesMut;

#[derive(Debug, Serialize)]
pub struct AttachmentResponse {
    id: String,
    task_id: String,
    file_name: String,
    file_size: i32,
    mime_type: String,
    created_at: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/projects/{project_id}/tasks/{task_id}/attachments")
            .route("", web::post().to(upload_attachment))
            .route("/{attachment_id}", web::delete().to(delete_attachment))
    );
}

async fn save_file(mut payload: Multipart, upload_dir: &str) -> Result<(String, i64, String, String), Box<dyn std::error::Error>> {
    // Create upload directory if it doesn't exist
    std::fs::create_dir_all(upload_dir)?;

    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_type = field.content_disposition();
        let filename = content_type
            .get_filename()
            .ok_or("No filename provided")?
            .to_string();

        let file_id = Uuid::new_v4();
        let extension = Path::new(&filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        let file_name = format!("{}.{}", file_id, extension);
        let filepath = format!("{}/{}", upload_dir, file_name);
        
        let mime_type = field.content_type().map(|m| m.to_string()).unwrap_or_default();
        
        // Collect chunks into a BytesMut buffer
        let mut buffer = BytesMut::new();
        while let Some(chunk) = field.next().await {
            let data = chunk?;
            buffer.extend_from_slice(&data);
        }
        
        // Write the complete buffer to file
        std::fs::write(&filepath, &buffer)?;
        let size = buffer.len() as i64;

        return Ok((file_name, size, mime_type, filepath));
    }

    Err("No file found in request".into())
}

async fn upload_attachment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String)>,
    payload: Multipart,
    user_id: web::ReqData<Uuid>, // From auth middleware
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

    // Save uploaded file
    let upload_dir = format!("uploads/tasks/{}", task_id);
    let (file_name, file_size, mime_type, storage_path) = match save_file(payload, &upload_dir).await {
        Ok(file_info) => file_info,
        Err(e) => return HttpResponse::InternalServerError().json(format!("File upload failed: {}", e)),
    };

    // Create attachment record
    let attachment = attachments::ActiveModel {
        id: Set(Uuid::new_v4()),
        task_id: Set(task_id),
        user_id: Set(*user_id), // From auth middleware
        file_name: Set(file_name.clone()),
        file_size: Set(file_size),
        mime_type: Set(mime_type.clone()),
        storage_path: Set(storage_path),
        created_at: Set(Utc::now().into()),
    };

    match attachment.insert(db.get_ref()).await {
        Ok(attachment) => {
            let response = AttachmentResponse {
                id: attachment.id.to_string(),
                task_id: attachment.task_id.to_string(),
                file_name: attachment.file_name,
                file_size: attachment.file_size as i32, // Convert i64 to i32
                mime_type: attachment.mime_type,
                created_at: attachment.created_at.to_rfc3339(),
            };
            HttpResponse::Created().json(response)
        }
        Err(e) => {
            // Clean up uploaded file
            let _ = std::fs::remove_file(format!("{}/{}", upload_dir, file_name));
            HttpResponse::InternalServerError().json(format!("Could not create attachment: {}", e))
        }
    }
}

async fn delete_attachment(
    db: web::Data<DatabaseConnection>,
    path: web::Path<(String, String, String)>,
    user_id: web::ReqData<Uuid>, // From auth middleware
) -> impl Responder {
    let (project_id, task_id, attachment_id) = match (
        Uuid::parse_str(&path.0),
        Uuid::parse_str(&path.1),
        Uuid::parse_str(&path.2),
    ) {
        (Ok(pid), Ok(tid), Ok(aid)) => (pid, tid, aid),
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

    // Get attachment to verify ownership and get filename
    let attachment = match Attachments::find_by_id(attachment_id)
        .filter(attachments::Column::TaskId.eq(task_id))
        .one(db.get_ref())
        .await 
    {
        Ok(Some(a)) => a,
        Ok(None) => return HttpResponse::NotFound().json("Attachment not found"),
        Err(e) => return HttpResponse::InternalServerError().json(format!("Database error: {}", e)),
    };

    // Verify attachment belongs to user
    if attachment.user_id != *user_id {
        return HttpResponse::Forbidden().json("Not authorized to delete this attachment");
    }

    // Delete file
    let file_path = format!("uploads/tasks/{}/{}", task_id, attachment.file_name);
    if let Err(e) = std::fs::remove_file(&file_path) {
        return HttpResponse::InternalServerError().json(format!("Could not delete file: {}", e));
    }

    // Delete attachment record
    match Attachments::delete_by_id(attachment_id).exec(db.get_ref()).await {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(format!("Could not delete attachment: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn test_upload_attachment() {
        // Implement multipart file upload test
    }
}
