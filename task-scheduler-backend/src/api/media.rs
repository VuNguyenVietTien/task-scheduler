use actix_web::{web, HttpResponse, Error, error};
use actix_multipart::Multipart;
use futures::{StreamExt, TryStreamExt};
use std::io::Write;
use std::fs;
use std::path::Path;
use chrono::Utc;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub id: String,
    pub filename: String,
    pub mimetype: String,
    pub size: i32,
    pub url: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum StorageType {
    #[serde(rename = "local")]
    Local,
    #[serde(rename = "google_drive")]
    GoogleDrive,
}

impl Default for StorageType {
    fn default() -> Self {
        StorageType::Local
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/media")
            .route("/upload", web::post().to(upload_file))
            .route("/{file_path:.*}", web::get().to(serve_file))
    );
}

/// REST API để upload file
async fn upload_file(mut payload: Multipart) -> Result<HttpResponse, Error> {
    // Lấy đường dẫn thư mục upload từ biến môi trường
    let upload_dir = env::var("MEDIA_UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string());
    let upload_path = format!("{}/images", upload_dir);
    let media_base_url = env::var("MEDIA_BASE_URL").unwrap_or_else(|_| "/media".to_string());
    
    // Đảm bảo thư mục upload tồn tại
    fs::create_dir_all(&upload_path)
        .map_err(|e| error::ErrorInternalServerError(format!("Could not create directory: {}", e)))?;

    let mut storage_type = StorageType::default();
    let mut file_data = None;
    
    // Lặp qua các phần của multipart form
    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_disposition = field.content_disposition();
        let field_name = content_disposition
            .get_name()
            .ok_or_else(|| error::ErrorBadRequest("No field name"))?;
            
        if field_name == "storage_type" {
            // Xử lý storage_type (nếu có)
            let mut data = Vec::new();
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| error::ErrorInternalServerError(format!("Error reading field: {}", e)))?;
                data.extend_from_slice(&chunk);
            }
            
            let value = String::from_utf8(data)
                .map_err(|e| error::ErrorBadRequest(format!("Invalid UTF-8: {}", e)))?;
                
            if value == "google_drive" {
                storage_type = StorageType::GoogleDrive;
            }
        } else if field_name == "file" {
            // Xử lý phần file
            let filename = content_disposition
                .get_filename()
                .ok_or_else(|| error::ErrorBadRequest("No filename"))?
                .to_owned();
                
            let content_type = field.content_type().map(|ct| ct.to_string()).unwrap_or_default();
            
            // Kiểm tra kiểu file
            if !content_type.starts_with("image/") {
                return Err(error::ErrorBadRequest("Only image files are allowed"));
            }
            
            // Tạo tên file duy nhất
            let file_id = Uuid::new_v4();
            let extension = Path::new(&filename)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("bin");
                
            let unique_filename = format!("{}.{}", file_id, extension);
            let file_path = format!("{}/{}", upload_path, unique_filename);
            
            // Đọc dữ liệu file
            let mut data = Vec::new();
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| error::ErrorInternalServerError(format!("Error reading file: {}", e)))?;
                data.extend_from_slice(&chunk);
            }
            
            // Kiểm tra kích thước file
            if data.len() > 5 * 1024 * 1024 { // 5MB
                return Err(error::ErrorBadRequest("File too large, maximum size is 5MB"));
            }
            
            // Lưu file
            fs::write(&file_path, &data)
                .map_err(|e| error::ErrorInternalServerError(format!("Could not write file: {}", e)))?;
                
            // Chuẩn bị URL
            let url = format!("{}/images/{}", media_base_url, unique_filename);
            
            // Lưu thông tin
            file_data = Some((file_id, filename, content_type, data.len(), url));
        }
    }
    
    // Kiểm tra xem có file được upload không
    if let Some((id, filename, mimetype, size, url)) = file_data {
        let response = UploadResponse {
            id: id.to_string(),
            filename,
            mimetype,
            size: size as i32,
            url,
            created_at: Utc::now().to_rfc3339(),
        };
        
        Ok(HttpResponse::Ok().json(response))
    } else {
        Err(error::ErrorBadRequest("No file uploaded"))
    }
}

/// Serve static files
async fn serve_file(path: web::Path<String>) -> Result<HttpResponse, Error> {
    let file_path = path.into_inner();
    let upload_dir = env::var("MEDIA_UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string());
    let full_path = format!("{}/{}", upload_dir, file_path);
    
    if !Path::new(&full_path).exists() {
        return Err(error::ErrorNotFound("File not found"));
    }
    
    // Đọc dữ liệu file
    let data = fs::read(&full_path)
        .map_err(|e| error::ErrorInternalServerError(format!("Error reading file: {}", e)))?;
        
    // Xác định MIME type từ đuôi file
    let mime_type = match Path::new(&file_path).extension().and_then(|ext| ext.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };
    
    Ok(HttpResponse::Ok()
        .content_type(mime_type)
        .body(data))
} 