use async_graphql::*;
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
use uuid::Uuid;

use crate::{
    db::entities::{AttachmentEntity, AttachmentModel},
    graphql::{
        context::ContextExt,
        map_db_err,
        types::Attachment,
    },
};

#[derive(Default)]
pub struct AttachmentQuery;

#[Object]
impl AttachmentQuery {
    async fn task_attachments(&self, ctx: &Context<'_>, task_id: ID) -> Result<Vec<Attachment>, Error> {
        let db = ctx.get_db();
        let task_uuid = Uuid::parse_str(&task_id.to_string())?;

        let attachments = AttachmentEntity::find()
            .filter(crate::db::entities::attachment::Column::TaskId.eq(task_uuid))
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
    // Upload functionality is temporarily disabled
    async fn upload_file(
        &self,
        _ctx: &Context<'_>,
        _task_id: ID,
        _filename: String,
    ) -> Result<Attachment, Error> {
        Err(Error::new("File upload is not implemented yet"))
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
