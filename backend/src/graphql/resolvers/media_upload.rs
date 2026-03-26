use async_graphql::*;
use uuid::Uuid;
use std::path::Path;
use async_std::io::WriteExt;
use chrono::Utc;
use async_std::fs;

use crate::graphql::types::media_upload::{MediaUploadEntity, MediaUploadInput, MediaUploadResponse, StorageType};

#[derive(Default)]
pub struct MediaUploadMutation;

#[Object]
impl MediaUploadMutation {
    /// Upload a file to the server
    async fn upload_image(&self, ctx: &Context<'_>, input: MediaUploadInput) -> Result<MediaUploadResponse> {
        // Trong bản demo, chúng ta chỉ giả lập việc tải file
        let storage_type = input.storage_type.unwrap_or_default();
        
        // Mô phỏng đọc thông tin file
        // Loại bỏ logic đọc file để tránh lỗi
        let file_bytes = &[0u8; 1024]; // Mô phỏng dữ liệu tệp tin
        let size = file_bytes.len() as i32;
        
        // Tạo ID và đường dẫn lưu trữ
        let id = Uuid::new_v4();
        let today = Utc::now();
        let year_month = today.format("%Y/%m").to_string();
        
        // Tạo thư mục nếu chưa tồn tại
        let upload_dir = format!("uploads/{}", year_month);
        fs::create_dir_all(&upload_dir).await.map_err(|e| format!("Failed to create directory: {}", e))?;
        
        // Tạo thông tin file
        let filename = "example_file.jpg".to_string();
        let extension = Path::new(&filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("bin");
            
        let new_filename = format!("{}_{}.{}", id, filename.replace('.', "_"), extension);
        let storage_path = format!("{}/{}", upload_dir, new_filename);
        
        // Lưu file vào hệ thống
        let mut file = fs::File::create(&storage_path).await.map_err(|e| format!("Failed to create file: {}", e))?;
        file.write_all(file_bytes).await.map_err(|e| format!("Failed to write file: {}", e))?;
        
        // Tạo URL công khai
        let url = format!("/api/media/{}", id);
        
        // Tạo entity
        let entity = MediaUploadEntity {
            id,
            filename,
            mimetype: "image/jpeg".to_string(),
            size,
            url,
            storage_path,
            storage_type,
            user_id: Uuid::nil(), // Trong bản demo, chúng ta dùng uuid zero
            created_at: today,
            deleted_at: None,
        };
        
        // Trong bản demo, chúng ta không thực sự lưu vào database
        
        // Trả về response
        Ok(entity.into())
    }
    
    /// Delete an uploaded image
    async fn delete_image(&self, _ctx: &Context<'_>, id: ID) -> Result<bool> {
        // Trong bản demo, chúng ta giả lập việc xóa
        let file_id = Uuid::parse_str(&id).map_err(|_| "Invalid ID format")?;
        
        // Mô phỏng xóa file
        println!("Deleting file with ID: {}", file_id);
        
        Ok(true)
    }
}