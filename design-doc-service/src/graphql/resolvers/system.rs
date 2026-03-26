use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::module as module_queries;
use crate::db::queries::system as queries;
use crate::db::queries::tag as tag_queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;

/// GraphQL output type for a System entity
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct SystemType {
    pub id: Uuid,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub metadata: serde_json::Value,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_graphql::ComplexObject]
impl SystemType {
    async fn modules(&self, ctx: &Context<'_>) -> Result<Vec<super::module::ModuleType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let modules = module_queries::list_modules(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(modules.into_iter().map(|m| m.into()).collect())
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<super::tag::TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let tags = tag_queries::get_entity_tags(&gql_ctx.pool, "system", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }
}

impl From<crate::db::models::system::System> for SystemType {
    fn from(s: crate::db::models::system::System) -> Self {
        Self {
            id: s.id,
            project_id: s.project_id,
            name: s.name,
            description: s.description,
            metadata: s.metadata,
            created_by: s.created_by,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

#[derive(InputObject)]
pub struct CreateSystemInput {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateSystemInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Default)]
pub struct SystemQuery;

#[Object]
impl SystemQuery {
    async fn systems(&self, ctx: &Context<'_>, project_id: String) -> Result<Vec<SystemType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let systems = queries::list_systems(&gql_ctx.pool, &project_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(systems.into_iter().map(|s| s.into()).collect())
    }

    async fn system(&self, ctx: &Context<'_>, id: Uuid) -> Result<Option<SystemType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let system = queries::get_system(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(system.map(|s| s.into()))
    }
}

#[derive(Default)]
pub struct SystemMutation;

#[Object]
impl SystemMutation {
    async fn create_system(
        &self,
        ctx: &Context<'_>,
        input: CreateSystemInput,
    ) -> Result<SystemType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(&user_id)
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let system = queries::create_system(
            &gql_ctx.pool,
            &input.project_id,
            &input.name,
            input.description.as_deref(),
            &user_id,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(system.into())
    }

    async fn update_system(
        &self,
        ctx: &Context<'_>,
        input: UpdateSystemInput,
    ) -> Result<SystemType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let system = queries::update_system(
            &gql_ctx.pool,
            input.id,
            input.name.as_deref(),
            input.description.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(system.into())
    }

    async fn delete_system(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_system(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
