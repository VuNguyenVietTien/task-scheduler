use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::tag as queries;
use crate::error::{self, AppError};
use crate::graphql::context::GqlContext;

/// GraphQL output type for a Tag entity
#[derive(SimpleObject)]
pub struct TagType {
    pub id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<crate::db::models::tag::Tag> for TagType {
    fn from(t: crate::db::models::tag::Tag) -> Self {
        Self {
            id: t.id,
            name: t.name,
            color: t.color,
            created_at: t.created_at,
        }
    }
}

/// GraphQL output type for an EntityTag join record
#[derive(SimpleObject)]
pub struct EntityTagType {
    pub id: Uuid,
    pub tag_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub created_at: DateTime<Utc>,
}

impl From<crate::db::models::tag::EntityTag> for EntityTagType {
    fn from(et: crate::db::models::tag::EntityTag) -> Self {
        Self {
            id: et.id,
            tag_id: et.tag_id,
            entity_type: et.entity_type,
            entity_id: et.entity_id,
            created_at: et.created_at,
        }
    }
}

#[derive(InputObject)]
pub struct CreateTagInput {
    pub name: String,
    pub color: Option<String>,
}

#[derive(InputObject)]
pub struct AddEntityTagInput {
    pub tag_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(InputObject)]
pub struct RemoveEntityTagInput {
    pub tag_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(Default)]
pub struct TagQuery;

#[Object]
impl TagQuery {
    /// List all available tags
    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let tags = queries::list_tags(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }

    /// List tags attached to a specific entity
    async fn entity_tags(
        &self,
        ctx: &Context<'_>,
        entity_type: String,
        entity_id: Uuid,
    ) -> Result<Vec<TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let tags = queries::get_entity_tags(&gql_ctx.pool, &entity_type, entity_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }
}

#[derive(Default)]
pub struct TagMutation;

#[Object]
impl TagMutation {
    async fn create_tag(&self, ctx: &Context<'_>, input: CreateTagInput) -> Result<TagType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let tag = queries::create_tag(&gql_ctx.pool, &input.name, input.color.as_deref())
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tag.into())
    }

    async fn delete_tag(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_tag(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }

    async fn add_entity_tag(
        &self,
        ctx: &Context<'_>,
        input: AddEntityTagInput,
    ) -> Result<EntityTagType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        error::validate_entity_type(&input.entity_type).map_err(|e| e.into_graphql_error())?;
        let et = queries::add_entity_tag(
            &gql_ctx.pool,
            input.tag_id,
            &input.entity_type,
            input.entity_id,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(et.into())
    }

    async fn remove_entity_tag(
        &self,
        ctx: &Context<'_>,
        input: RemoveEntityTagInput,
    ) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        error::validate_entity_type(&input.entity_type).map_err(|e| e.into_graphql_error())?;
        queries::remove_entity_tag(
            &gql_ctx.pool,
            input.tag_id,
            &input.entity_type,
            input.entity_id,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
