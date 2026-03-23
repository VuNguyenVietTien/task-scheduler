use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::document as document_queries;
use crate::db::queries::external_link as external_link_queries;
use crate::db::queries::screen as screen_queries;
use crate::db::queries::tag as tag_queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;

/// GraphQL output type for a DocumentAudit entry
#[derive(SimpleObject)]
pub struct DocumentVersionType {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub action: String,
    pub old_data: Option<serde_json::Value>,
    pub new_data: Option<serde_json::Value>,
    pub changed_by: i64,
    pub changed_at: DateTime<Utc>,
}

impl From<crate::db::models::audit::DocumentAudit> for DocumentVersionType {
    fn from(a: crate::db::models::audit::DocumentAudit) -> Self {
        Self {
            id: a.id,
            entity_type: a.entity_type,
            entity_id: a.entity_id,
            action: a.action,
            old_data: a.old_data,
            new_data: a.new_data,
            changed_by: a.changed_by,
            changed_at: a.changed_at,
        }
    }
}

/// GraphQL output type for a DesignDocument entity
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct DocumentType {
    pub id: Uuid,
    pub module_id: Uuid,
    pub name: String,
    pub status: String,
    pub description: Option<String>,
    pub source_tool: Option<String>,
    pub last_imported_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_graphql::ComplexObject]
impl DocumentType {
    async fn screens(&self, ctx: &Context<'_>) -> Result<Vec<super::screen::ScreenType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let screens = screen_queries::list_screens(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screens.into_iter().map(|s| s.into()).collect())
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<super::tag::TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let tags = tag_queries::get_entity_tags(&gql_ctx.pool, "document", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }

    /// Audit trail / version history for this document
    async fn document_versions(
        &self,
        ctx: &Context<'_>,
    ) -> Result<Vec<DocumentVersionType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let versions = document_queries::list_document_audit(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(versions.into_iter().map(|v| v.into()).collect())
    }

    async fn external_links(
        &self,
        ctx: &Context<'_>,
    ) -> Result<Vec<super::external_link::ExternalLinkType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let links = external_link_queries::list_entity_links(&gql_ctx.pool, "document", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(links.into_iter().map(|l| l.into()).collect())
    }
}

impl From<crate::db::models::document::DesignDocument> for DocumentType {
    fn from(d: crate::db::models::document::DesignDocument) -> Self {
        Self {
            id: d.id,
            module_id: d.module_id,
            name: d.name,
            status: d.status,
            description: d.description,
            source_tool: d.source_tool,
            last_imported_at: d.last_imported_at,
            metadata: d.metadata,
            created_by: d.created_by,
            created_at: d.created_at,
            updated_at: d.updated_at,
        }
    }
}

#[derive(InputObject)]
pub struct CreateDocumentInput {
    pub module_id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateDocumentInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    /// Status transitions: draft -> review -> approved -> archived
    pub status: Option<String>,
}

#[derive(Default)]
pub struct DocumentQuery;

#[Object]
impl DocumentQuery {
    async fn documents(
        &self,
        ctx: &Context<'_>,
        module_id: Uuid,
    ) -> Result<Vec<DocumentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let docs = document_queries::list_documents(&gql_ctx.pool, module_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(docs.into_iter().map(|d| d.into()).collect())
    }

    async fn document(&self, ctx: &Context<'_>, id: Uuid) -> Result<Option<DocumentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let doc = document_queries::get_document(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(doc.map(|d| d.into()))
    }

    /// Returns the full document tree for AI consumption.
    /// Nested screens → components → fieldMappings, flows → steps, tags, and
    /// external_links are all resolved lazily via ComplexObject fields.
    async fn export_document_for_ai(
        &self,
        ctx: &Context<'_>,
        document_id: Uuid,
    ) -> Result<Option<DocumentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let doc = document_queries::get_document(&gql_ctx.pool, document_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(doc.map(|d| d.into()))
    }
}

#[derive(Default)]
pub struct DocumentMutation;

#[Object]
impl DocumentMutation {
    async fn create_document(
        &self,
        ctx: &Context<'_>,
        input: CreateDocumentInput,
    ) -> Result<DocumentType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let doc = document_queries::create_document(
            &gql_ctx.pool,
            input.module_id,
            &input.name,
            input.description.as_deref(),
            user_id,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(doc.into())
    }

    async fn update_document(
        &self,
        ctx: &Context<'_>,
        input: UpdateDocumentInput,
    ) -> Result<DocumentType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        // Validate status if provided
        if let Some(ref status) = input.status {
            let valid = ["draft", "review", "approved", "archived"];
            if !valid.contains(&status.as_str()) {
                return Err(AppError::Validation(format!(
                    "Invalid status '{}'. Must be one of: {}",
                    status,
                    valid.join(", ")
                ))
                .into_graphql_error()
                .into());
            }
        }
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let doc = document_queries::update_document(
            &gql_ctx.pool,
            input.id,
            input.name.as_deref(),
            input.description.as_deref(),
            input.status.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(doc.into())
    }

    async fn delete_document(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        document_queries::delete_document(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
