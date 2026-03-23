use async_graphql::{Context, Object, Result, SimpleObject};
use uuid::Uuid;

use crate::db::queries::impact as queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;

/// GraphQL output type for an impact analysis result row.
#[derive(SimpleObject)]
pub struct ImpactResultType {
    pub component_id: Uuid,
    pub component_custom_id: String,
    pub component_name: String,
    pub screen_id: Uuid,
    pub screen_name: String,
    pub document_id: Uuid,
    pub document_name: String,
    pub db_table: String,
    pub db_column: String,
}

impl From<queries::ImpactResult> for ImpactResultType {
    fn from(r: queries::ImpactResult) -> Self {
        Self {
            component_id: r.component_id,
            component_custom_id: r.component_custom_id,
            component_name: r.component_name,
            screen_id: r.screen_id,
            screen_name: r.screen_name,
            document_id: r.document_id,
            document_name: r.document_name,
            db_table: r.db_table,
            db_column: r.db_column,
        }
    }
}

#[derive(Default)]
pub struct ImpactQuery;

#[Object]
impl ImpactQuery {
    /// Find all UI components that reference a specific database field (table + column).
    /// Optionally scoped to a single system.
    async fn field_impact(
        &self,
        ctx: &Context<'_>,
        db_table: String,
        db_column: String,
        system_id: Option<Uuid>,
    ) -> Result<Vec<ImpactResultType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let results = queries::field_impact(&gql_ctx.pool, &db_table, &db_column, system_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(results.into_iter().map(|r| r.into()).collect())
    }

    /// Find all components that share field mappings with the given component (cross-document impact).
    async fn component_dependencies(
        &self,
        ctx: &Context<'_>,
        component_id: Uuid,
    ) -> Result<Vec<ImpactResultType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let results = queries::component_dependencies(&gql_ctx.pool, component_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(results.into_iter().map(|r| r.into()).collect())
    }
}
