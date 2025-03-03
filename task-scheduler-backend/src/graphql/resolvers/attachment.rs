use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::{
    db::entities::{
        AttachmentEntity, AttachmentModel, AttachmentActiveModel,
        attachment::Column as AttachmentColumn,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::Attachment,
    },
};

use sanitize_filename::sanitize;

#[derive(Default)]
pub struct AttachmentQuery;

#[Object]
impl AttachmentQuery {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn attachment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Attachment>, Error> {
        let db = ctx.get_db();
        let attachment = AttachmentEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(attachment.map(|a| a.into()))
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn task_attachments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<Attachment>, Error> {
        let db = ctx.get_db();
        let task_uuid = Uuid::parse_str(&task_id.to_string())?;

        let attachments = AttachmentEntity::find()
            .filter(AttachmentColumn::TaskId.eq(task_uuid))
            .order_by(AttachmentColumn::CreatedAt, sea_orm::Order::Desc)
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(attachments.into_iter().map(|a| a.into()).collect())
    }
}

#[derive(Default)]
pub struct AttachmentMutation;

#[Object]
impl AttachmentMutation {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn upload_attachment(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        file: Upload,
    ) -> Result<Attachment, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;
        let task_uuid = Uuid::parse_str(&task_id.to_string())?;

        // Get the file data
        let file = file.value(ctx)?;
        let filename = sanitize(&file.filename);
        let content_type = file.content_type.clone().unwrap_or_else(|| "application/octet-stream".into());
        let size = file.size().unwrap_or(0) as i64;

        // TODO: Store file in S3 or local filesystem
        let storage_path = format!("uploads/{}/{}", task_uuid, filename);

        let attachment = AttachmentActiveModel {
            id: Set(Uuid::new_v4()),
            task_id: Set(task_uuid),
            user_id: Set(auth_user.id),
            file_name: Set(filename), 
            file_size: Set(size),
            mime_type: Set(content_type),
            storage_path: Set(storage_path),
            created_at: Set(current_time_db()),
        };

        let attachment = attachment.insert(db).await.map_err(map_db_err)?;

        Ok(attachment.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn delete_attachment(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<bool, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;
        let attachment_id = Uuid::parse_str(&id.to_string())?;

        let attachment = AttachmentEntity::find_by_id(attachment_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Attachment not found"))?;

        if attachment.user_id != auth_user.id && !auth_user.is_admin() {
            return Err("Not authorized to delete this attachment".into());
        }

        // TODO: Delete file from storage

        AttachmentEntity::delete_by_id(attachment_id)
            .exec(db)
            .await
            .map_err(map_db_err)?;

        Ok(true)
    }
}

impl From<AttachmentModel> for Attachment {
    fn from(model: AttachmentModel) -> Self {
        Attachment {
            id: model.id.into(),
            task_id: model.task_id.into(),
            user_id: model.user_id.into(),
            file_name: model.file_name,
            file_size: model.file_size,
            mime_type: model.mime_type,
            storage_path: model.storage_path,
            created_at: model.created_at,
        }
    }
}
