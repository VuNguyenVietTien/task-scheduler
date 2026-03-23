use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::external_link as queries;
use crate::error::{self, AppError};
use crate::graphql::context::GqlContext;

/// GraphQL output type for an ExternalLink entity
#[derive(SimpleObject)]
pub struct ExternalLinkType {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub provider: String,
    pub external_id: String,
    pub external_url: Option<String>,
    pub sync_status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::db::models::external_link::ExternalLink> for ExternalLinkType {
    fn from(e: crate::db::models::external_link::ExternalLink) -> Self {
        Self {
            id: e.id,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            provider: e.provider,
            external_id: e.external_id,
            external_url: e.external_url,
            sync_status: e.sync_status,
            last_synced_at: e.last_synced_at,
            metadata: e.metadata,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}

#[derive(InputObject)]
pub struct LinkExternalInput {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub provider: String,
    pub external_id: String,
    pub external_url: Option<String>,
}

#[derive(Default)]
pub struct ExternalLinkQuery;

#[Object]
impl ExternalLinkQuery {
    async fn external_links(
        &self,
        ctx: &Context<'_>,
        entity_type: String,
        entity_id: Uuid,
    ) -> Result<Vec<ExternalLinkType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let links = queries::list_entity_links(&gql_ctx.pool, &entity_type, entity_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(links.into_iter().map(|l| l.into()).collect())
    }
}

#[derive(Default)]
pub struct ExternalLinkMutation;

#[Object]
impl ExternalLinkMutation {
    async fn link_external(
        &self,
        ctx: &Context<'_>,
        input: LinkExternalInput,
    ) -> Result<ExternalLinkType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        error::validate_entity_type(&input.entity_type).map_err(|e| e.into_graphql_error())?;
        let link = queries::create_external_link(
            &gql_ctx.pool,
            &input.entity_type,
            input.entity_id,
            &input.provider,
            &input.external_id,
            input.external_url.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(link.into())
    }

    async fn unlink_external(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_external_link(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }

    async fn sync_external_link(&self, ctx: &Context<'_>, id: Uuid) -> Result<ExternalLinkType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        // Updates status to "synced" — real Jira/Trello API calls in future phase
        let link = queries::update_sync_status(&gql_ctx.pool, id, "synced")
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(link.into())
    }
}
