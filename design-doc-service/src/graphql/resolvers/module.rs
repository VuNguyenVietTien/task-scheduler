use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::document as document_queries;
use crate::db::queries::module as queries;
use crate::db::queries::tag as tag_queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;

/// GraphQL output type for a Module entity
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct ModuleType {
    pub id: Uuid,
    pub system_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_graphql::ComplexObject]
impl ModuleType {
    async fn documents(&self, ctx: &Context<'_>) -> Result<Vec<super::document::DocumentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let docs = document_queries::list_documents(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(docs.into_iter().map(|d| d.into()).collect())
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<super::tag::TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let tags = tag_queries::get_entity_tags(&gql_ctx.pool, "module", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }
}

impl From<crate::db::models::module::Module> for ModuleType {
    fn from(m: crate::db::models::module::Module) -> Self {
        Self {
            id: m.id,
            system_id: m.system_id,
            name: m.name,
            description: m.description,
            sort_order: m.sort_order,
            metadata: m.metadata,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(InputObject)]
pub struct CreateModuleInput {
    pub system_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(InputObject)]
pub struct UpdateModuleInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Default)]
pub struct ModuleQuery;

#[Object]
impl ModuleQuery {
    async fn modules(&self, ctx: &Context<'_>, system_id: Uuid) -> Result<Vec<ModuleType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let modules = queries::list_modules(&gql_ctx.pool, system_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(modules.into_iter().map(|m| m.into()).collect())
    }

    async fn module(&self, ctx: &Context<'_>, id: Uuid) -> Result<Option<ModuleType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let module = queries::get_module(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(module.map(|m| m.into()))
    }
}

#[derive(Default)]
pub struct ModuleMutation;

#[Object]
impl ModuleMutation {
    async fn create_module(
        &self,
        ctx: &Context<'_>,
        input: CreateModuleInput,
    ) -> Result<ModuleType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let module = queries::create_module(
            &gql_ctx.pool,
            input.system_id,
            &input.name,
            input.description.as_deref(),
            input.sort_order,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(module.into())
    }

    async fn update_module(
        &self,
        ctx: &Context<'_>,
        input: UpdateModuleInput,
    ) -> Result<ModuleType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let module = queries::update_module(
            &gql_ctx.pool,
            input.id,
            input.name.as_deref(),
            input.description.as_deref(),
            input.sort_order,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(module.into())
    }

    async fn delete_module(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_module(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
