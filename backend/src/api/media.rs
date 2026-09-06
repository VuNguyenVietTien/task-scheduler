use actix_multipart::Multipart;
use actix_web::{error, web, Error, HttpResponse};
use chrono::Utc;
use futures::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use uuid::Uuid;

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
            .route("/{file_path:.*}", web::get().to(serve_file)),
    );
}

/// REST API để upload file
async fn upload_file(mut payload: Multipart) -> Result<HttpResponse, Error> {
    println!("=== API upload_file được gọi ===");
    println!("=== Timestamp: {} ===", Utc::now().to_rfc3339());

    // Lấy đường dẫn thư mục upload từ biến môi trường
    let upload_dir = env::var("MEDIA_UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string());
    let upload_path = format!("{}/images", upload_dir);
    let media_base_url = env::var("MEDIA_BASE_URL").unwrap_or_else(|_| "/media".to_string());

    println!("Thông tin môi trường:");
    println!("- Upload dir: {}", upload_dir);
    println!("- Upload path: {}", upload_path);
    println!("- Media base URL: {}", media_base_url);

    // Đảm bảo thư mục upload tồn tại
    match fs::create_dir_all(&upload_path) {
        Ok(_) => println!("Thư mục upload đảm bảo tồn tại: {}", upload_path),
        Err(e) => {
            let error_msg = format!("Could not create directory: {}", e);
            println!("LỖI: {}", error_msg);
            return Err(error::ErrorInternalServerError(error_msg));
        }
    }

    let mut storage_type = StorageType::default();
    let mut file_data = None;
    let mut fields_info = Vec::new();

    println!("Bắt đầu xử lý multipart form data...");

    // Lặp qua các phần của multipart form
    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_disposition = field.content_disposition();
        let field_name = content_disposition
            .get_name()
            .unwrap_or("unknown")
            .to_string();

        println!("Nhận field: {}", field_name);

        if field_name == "storage_type" {
            // Xử lý storage_type (nếu có)
            let mut data = Vec::new();

            // Đọc dữ liệu từ field
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| {
                    println!("LỖI khi đọc storage_type: {}", e);
                    error::ErrorInternalServerError(format!("Error reading field: {}", e))
                })?;
                data.extend_from_slice(&chunk);
            }

            let value = String::from_utf8(data).map_err(|e| {
                println!("LỖI UTF-8 không hợp lệ: {}", e);
                error::ErrorBadRequest(format!("Invalid UTF-8: {}", e))
            })?;

            println!("Storage type: {}", value);
            fields_info.push(json!({
                "field": field_name,
                "value": value
            }));

            if value == "google_drive" {
                storage_type = StorageType::GoogleDrive;
                println!("Đã chọn storage type: GoogleDrive");
            } else {
                println!("Sử dụng storage type mặc định: Local");
            }
        } else if field_name == "file" {
            // Xử lý phần file
            let filename = content_disposition
                .get_filename()
                .map(ToString::to_string)
                .unwrap_or_else(|| {
                    println!("CẢNH BÁO: Không có tên file, sử dụng tên mặc định");
                    "unnamed-file".to_string()
                });

            let content_type = field
                .content_type()
                .map(|ct| ct.to_string())
                .unwrap_or_else(|| {
                    println!("CẢNH BÁO: Không có content-type, sử dụng mặc định");
                    "application/octet-stream".to_string()
                });

            println!("File upload: {} ({})", filename, content_type);

            // Kiểm tra kiểu file
            if !content_type.starts_with("image/") {
                let error_msg = "Only image files are allowed";
                println!("LỖI: {}", error_msg);
                println!("Content-Type không được chấp nhận: {}", content_type);
                return Err(error::ErrorBadRequest(error_msg));
            }

            // Tạo tên file duy nhất
            let file_id = Uuid::new_v4();
            let extension = Path::new(&filename)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or_else(|| {
                    println!("CẢNH BÁO: Không phát hiện phần mở rộng, sử dụng bin");
                    "bin"
                });

            let unique_filename = format!("{}.{}", file_id, extension);
            let file_path = format!("{}/{}", upload_path, unique_filename);

            println!("Tên file đích: {}", unique_filename);
            println!("Đường dẫn lưu: {}", file_path);

            // Đọc dữ liệu file
            let mut data = Vec::new();
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| {
                    println!("LỖI khi đọc dữ liệu file: {}", e);
                    error::ErrorInternalServerError(format!("Error reading file: {}", e))
                })?;
                data.extend_from_slice(&chunk);
            }

            println!("Đã đọc {} bytes dữ liệu", data.len());

            // Kiểm tra kích thước file
            if data.len() > 5 * 1024 * 1024 {
                // 5MB
                let error_msg = "File too large, maximum size is 5MB";
                println!("LỖI: {}", error_msg);
                println!(
                    "Kích thước file: {} bytes, vượt quá giới hạn 5MB",
                    data.len()
                );
                return Err(error::ErrorBadRequest(error_msg));
            }

            // Lưu file
            match fs::write(&file_path, &data) {
                Ok(_) => println!("Đã lưu file thành công: {}", file_path),
                Err(e) => {
                    let error_msg = format!("Could not write file: {}", e);
                    println!("LỖI khi lưu file: {}", e);
                    return Err(error::ErrorInternalServerError(error_msg));
                }
            }

            // Chuẩn bị URL
            let url = format!("{}/images/{}", media_base_url, unique_filename);
            println!("URL trả về: {}", url);

            // Log chi tiết về file
            fields_info.push(json!({
                "field": field_name,
                "filename": filename,
                "content_type": content_type,
                "unique_filename": unique_filename,
                "size_bytes": data.len(),
                "url": url
            }));

            // Lưu thông tin
            file_data = Some((file_id, filename, content_type, data.len(), url));
        } else {
            // Field khác
            let mut data = Vec::new();

            // Đọc dữ liệu từ field
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| {
                    println!("LỖI khi đọc field {}: {}", field_name, e);
                    error::ErrorInternalServerError(format!("Error reading field: {}", e))
                })?;
                data.extend_from_slice(&chunk);
            }

            let value = String::from_utf8(data).map_err(|e| {
                println!("LỖI UTF-8 không hợp lệ trong field {}: {}", field_name, e);
                error::ErrorBadRequest(format!("Invalid UTF-8: {}", e))
            })?;

            println!("Field khác: {} = {}", field_name, value);
            fields_info.push(json!({
                "field": field_name,
                "value": value
            }));
        }
    }

    // Hiển thị JSON thông tin các field nhận được
    println!("TẤT CẢ CÁC FIELD FORM NHẬN ĐƯỢC (JSON):");
    println!(
        "{}",
        serde_json::to_string_pretty(&fields_info).unwrap_or_default()
    );

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

        println!("=== RESPONSE THÀNH CÔNG (JSON) ===");
        println!(
            "{}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );

        Ok(HttpResponse::Ok().json(response))
    } else {
        let error_msg = "No file uploaded";
        println!("LỖI: {}", error_msg);
        println!("Không tìm thấy field 'file' trong form data");

        let error_response = json!({
            "error": error_msg,
            "timestamp": Utc::now().to_rfc3339(),
            "fields_received": fields_info
        });

        println!("=== RESPONSE LỖI (JSON) ===");
        println!(
            "{}",
            serde_json::to_string_pretty(&error_response).unwrap_or_default()
        );

        Err(error::ErrorBadRequest(error_msg))
    }
}

/// Serve static files
async fn serve_file(path: web::Path<String>) -> Result<HttpResponse, Error> {
    let file_path = path.into_inner();
    let upload_dir = env::var("MEDIA_UPLOAD_DIR").unwrap_or_else(|_| "./uploads".to_string());
    let full_path = format!("{}/{}", upload_dir, file_path);

    println!("Serve file: {}", full_path);

    if !Path::new(&full_path).exists() {
        println!("File không tồn tại: {}", full_path);
        return Err(error::ErrorNotFound("File not found"));
    }

    // Đọc dữ liệu file
    let data = match fs::read(&full_path) {
        Ok(data) => {
            println!("Đọc thành công {} bytes", data.len());
            data
        }
        Err(e) => {
            let error_msg = format!("Error reading file: {}", e);
            println!("Lỗi: {}", error_msg);
            return Err(error::ErrorInternalServerError(error_msg));
        }
    };

    // Xác định MIME type từ đuôi file
    let mime_type = match Path::new(&file_path)
        .extension()
        .and_then(|ext| ext.to_str())
    {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };

    println!("Phục vụ file với MIME: {}", mime_type);

    Ok(HttpResponse::Ok().content_type(mime_type).body(data))
}
