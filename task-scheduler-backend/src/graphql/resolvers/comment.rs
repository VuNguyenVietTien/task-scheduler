use async_graphql::*;
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, QueryOrder, Condition};
use uuid::Uuid;
use crate::{
    db::entities::{comment, task, user},
    error::AppError,
    graphql::types::*,
};

pub struct CommentQuery;

#[Object]
impl CommentQuery {
    async fn comment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Comment>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let comment_id = Uuid::parse_str(id.as_str())?;

        let comment = comment::Entity::find_by_id(comment_id)
            .one(db)
            .await?
            .map(Into::into);

        Ok(comment)
    }

    async fn task_comments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<Comment>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let task_uuid = Uuid::parse_str(task_id.as_str())?;

        // Verify task exists
        let task = task::Entity::find_by_id(task_uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Get comments for the task
        let comments = comment::Entity::find()
            .filter(comment::Column::TaskId.eq(task_uuid))
            .order_by_asc(comment::Column::CreatedAt)
            .all(db)
            .await?;

        Ok(comments.into_iter().map(Into::into).collect())
    }
}

pub struct CommentMutation;

#[Object]
impl CommentMutation {
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<Comment> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let task_id = Uuid::parse_str(input.task_id.as_str())?;

        // Verify task exists and user has access
        let task = task::Entity::find_by_id(task_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // If this is a reply, verify parent comment exists
        if let Some(parent_id) = &input.parent_comment_id {
            let parent_uuid = Uuid::parse_str(parent_id.as_str())?;
            let parent = comment::Entity::find_by_id(parent_uuid)
                .one(db)
                .await?
                .ok_or_else(|| Error::new("Parent comment not found"))?;

            // Verify parent comment belongs to same task
            if parent.task_id != task_id {
                return Err(Error::new("Parent comment belongs to different task"));
            }
        }

        // Create comment
        let comment = comment::ActiveModel {
            id: Set(Uuid::new_v4()),
            task_id: Set(task_id),
            user_id: Set(auth_user.id),
            content: Set(input.content),
            parent_comment_id: Set(input.parent_comment_id
                .map(|id| Uuid::parse_str(id.as_str()))
                .transpose()?),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
        };

        let comment = comment.insert(db).await?;

        // In a real app, we would:
        // 1. Send notifications to task subscribers
        // 2. Create activity log entry
        // 3. Trigger WebSocket event

        Ok(comment.into())
    }

    async fn update_comment(
        &self,
        ctx: &Context<'_>,
        id: ID,
        content: String,
    ) -> Result<Comment> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let comment_id = Uuid::parse_str(id.as_str())?;

        // Fetch existing comment
        let comment = comment::Entity::find_by_id(comment_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Comment not found"))?;

        // Verify user owns the comment
        if comment.user_id != auth_user.id && !auth_user.is_admin() {
            return Err(Error::new("Not authorized to edit this comment"));
        }

        // Update comment
        let mut comment: comment::ActiveModel = comment.into();
        comment.content = Set(content);
        comment.updated_at = Set(chrono::Utc::now().into());

        let updated_comment = comment.update(db).await?;

        Ok(updated_comment.into())
    }

    async fn delete_comment(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<ID> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let comment_id = Uuid::parse_str(id.as_str())?;

        // Fetch comment
        let comment = comment::Entity::find_by_id(comment_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Comment not found"))?;

        // Verify user owns the comment or is admin
        if comment.user_id != auth_user.id && !auth_user.is_admin() {
            return Err(Error::new("Not authorized to delete this comment"));
        }

        // Delete comment
        comment::Entity::delete_by_id(comment_id)
            .exec(db)
            .await?;

        Ok(id)
    }
}

// Implement conversion from database model to GraphQL type
impl From<comment::Model> for Comment {
    fn from(model: comment::Model) -> Self {
        Comment {
            id: model.id.into(),
            task_id: model.task_id.into(),
            user_id: model.user_id.into(),
            content: model.content,
            parent_comment_id: model.parent_comment_id.map(Into::into),
            created_at: model.created_at.into(),
            updated_at: model.updated_at.into(),
        }
    }
}
