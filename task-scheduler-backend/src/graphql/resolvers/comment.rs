use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
    IntoActiveModel, Set,
};
use uuid::Uuid;

use crate::{
    db::entities::{
        CommentEntity, CommentModel, CommentActiveModel,
        comment::Column as CommentColumn,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{Comment, CreateCommentInput},
    },
};

#[derive(Default)]
pub struct CommentQuery;

#[Object]
impl CommentQuery {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn comment(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Comment>, Error> {
        let db = ctx.get_db();
        let comment = CommentEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(comment.map(|c| c.into()))
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn task_comments(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
    ) -> Result<Vec<Comment>, Error> {
        let db = ctx.get_db();
        let task_uuid = Uuid::parse_str(&task_id.to_string())?;

        let comments = CommentEntity::find()
            .filter(CommentColumn::TaskId.eq(task_uuid))
            .order_by(CommentColumn::CreatedAt, sea_orm::Order::Desc)
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(comments.into_iter().map(|c| c.into()).collect())
    }
}

#[derive(Default)]
pub struct CommentMutation;

#[Object]
impl CommentMutation {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn create_comment(
        &self,
        ctx: &Context<'_>,
        input: CreateCommentInput,
    ) -> Result<Comment, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        // Check if parent comment exists if specified
        if let Some(parent_id) = &input.parent_comment_id {
            let parent_exists = CommentEntity::find_by_id(Uuid::parse_str(&parent_id.to_string())?)
                .one(db)
                .await
                .map_err(map_db_err)?
                .is_some();

            if !parent_exists {
                return Err("Parent comment not found".into());
            }
        }

        let comment = CommentActiveModel {
            id: Set(Uuid::new_v4()),
            task_id: Set(Uuid::parse_str(&input.task_id.to_string())?),
            user_id: Set(auth_user.id),
            parent_comment_id: Set(input.parent_comment_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?),
            content: Set(input.content),
            created_at: Set(current_time_db()),
            updated_at: Set(current_time_db()),
        };

        let comment = comment.insert(db).await.map_err(map_db_err)?;

        Ok(comment.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn update_comment(
        &self,
        ctx: &Context<'_>,
        id: ID,
        content: String,
    ) -> Result<Comment, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;
        let comment_id = Uuid::parse_str(&id.to_string())?;

        let comment = CommentEntity::find_by_id(comment_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Comment not found"))?;

        // Check permissions
        if comment.user_id != auth_user.id && !auth_user.is_admin() {
            return Err("Not authorized to update comment".into());
        }

        let mut comment = comment.into_active_model();
        comment.content = Set(content);
        comment.updated_at = Set(current_time_db());

        let comment = comment.update(db).await.map_err(map_db_err)?;

        Ok(comment.into())
    }
}

impl From<CommentModel> for Comment {
    fn from(model: CommentModel) -> Self {
        Comment {
            id: model.id.into(),
            task_id: model.task_id.into(),
            user_id: model.user_id.into(),
            parent_comment_id: model.parent_comment_id.map(Into::into),
            content: model.content,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}
