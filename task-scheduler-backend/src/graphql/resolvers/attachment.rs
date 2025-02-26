use async_graphql::*;
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, QueryOrder};
use uuid::Uuid;
use crate::{
    db::entities::{attachment, task},
    error::AppError,
    graphql::types::*,
    config::Config,
};

pub struct AttachmentQuery;

#[Object]
impl AttachmentQuery {
    async fn attachment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Attachment>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let attachment_id = Uuid::parse_str(id.as_str())?;

        let attachment = attachment::Entity::find_by_id(attachment_id)
            .one(db)
            .await?
            .map(Into::into);

        Ok(attachment)
    }

    async fn task_attachments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<Attachment>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let task_uuid = Uuid::parse_str(task_id.as_str())?;

        // Verify task exists
        let task = task::Entity::find_by_id(task_uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Get attachments for the task
        let attachments = attachment::Entity::find()
            .filter(attachment::Column::TaskId.eq(task_uuid))
            .order_by_asc(attachment::Column::CreatedAt)
            .all(db)
            .await?;

        Ok(attachments.into_iter().map(Into::into).collect())
    }
}

pub struct AttachmentMutation;

#[Object]
impl AttachmentMutation {
    async fn upload_attachment(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        file: Upload,
    ) -> Result<Attachment> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let config = ctx.data::<Config>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let task_uuid = Uuid::parse_str(task_id.as_str())?;

        // Verify task exists
        let task = task::Entity::find_by_id(task_uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Process the uploaded file
        let upload_value = file.value(ctx).await?;
        let filename = upload_value.filename.clone();
        let content_type = upload_value.content_type.clone();
        let size = upload_value.size;

        // Validate file size
        if size > attachment::MAX_FILE_SIZE {
            return Err(Error::new("File too large"));
        }

        // Validate file type
        if !attachment::ALLOWED_MIME_TYPES.contains(&content_type.as_str()) {
            return Err(Error::new("File type not allowed"));
        }

        // Create a unique storage path
        let attachment_id = Uuid::new_v4();
        let storage_path = format!(
            "attachments/{}/{}/{}",
            task_uuid,
            attachment_id,
            sanitize_filename::sanitize(&filename)
        );

        // Upload file to Supabase Storage
        // Implementation note: In a real app, we would:
        // 1. Initialize Supabase client
        // 2. Upload file to storage bucket
        // 3. Get the public URL
        let storage_client = reqwest::Client::new();
        let upload_result = storage_client
            .post(&format!("{}/storage/v1/object/{}", config.supabase_url, storage_path))
            .header("Authorization", format!("Bearer {}", config.supabase_key))
            .header("Content-Type", &content_type)
            .body(upload_value.bytes)
            .send()
            .await
            .map_err(|e| Error::new(format!("Upload failed: {}", e)))?;

        if !upload_result.status().is_success() {
            return Err(Error::new("Failed to upload file to storage"));
        }

        // Create attachment record
        let attachment = attachment::ActiveModel {
            id: Set(attachment_id),
            task_id: Set(task_uuid),
            user_id: Set(auth_user.id),
            file_name: Set(filename),
            file_size: Set(size as i64),
            mime_type: Set(content_type),
            storage_path: Set(storage_path),
            created_at: Set(chrono::Utc::now().into()),
        };

        let attachment = attachment.insert(db).await?;

        Ok(attachment.into())
    }

    async fn delete_attachment(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<ID> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let config = ctx.data::<Config>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let attachment_id = Uuid::parse_str(id.as_str())?;

        // Fetch attachment
        let attachment = attachment::Entity::find_by_id(attachment_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Attachment not found"))?;

        // Verify user owns the attachment or is admin
        if attachment.user_id != auth_user.id && !auth_user.is_admin() {
            return Err(Error::new("Not authorized to delete this attachment"));
        }

        // Delete from Supabase storage
        let storage_client = reqwest::Client::new();
        let delete_result = storage_client
            .delete(&format!("{}/storage/v1/object/{}", config.supabase_url, attachment.storage_path))
            .header("Authorization", format!("Bearer {}", config.supabase_key))
            .send()
            .await
            .map_err(|e| Error::new(format!("Delete failed: {}", e)))?;

        if !delete_result.status().is_success() {
            return Err(Error::new("Failed to delete file from storage"));
        }

        // Delete attachment record
        attachment::Entity::delete_by_id(attachment_id)
            .exec(db)
            .await?;

        Ok(id)
    }
}

// Implement conversion from database model to GraphQL type
impl From<attachment::Model> for Attachment {
    fn from(model: attachment::Model) -> Self {
        Attachment {
            id: model.id.into(),
            task_id: model.task_id.into(),
            user_id: model.user_id.into(),
            file_name: model.file_name,
            file_size: model.file_size,
            mime_type: model.mime_type,
            storage_path: model.storage_path,
            created_at: model.created_at.into(),
        }
    }
}
