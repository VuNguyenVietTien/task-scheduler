use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::flow as queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;

/// GraphQL output type for a Flow entity, with lazily-resolved steps.
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct FlowType {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub mermaid_definition: Option<String>,
    pub flow_type: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_graphql::ComplexObject]
impl FlowType {
    /// Lazily load all steps for this flow, ordered by step_order.
    async fn steps(&self, ctx: &Context<'_>) -> Result<Vec<FlowStepType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let steps = queries::list_flow_steps(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(steps.into_iter().map(|s| s.into()).collect())
    }
}

impl From<crate::db::models::flow::Flow> for FlowType {
    fn from(f: crate::db::models::flow::Flow) -> Self {
        Self {
            id: f.id,
            document_id: f.document_id,
            name: f.name,
            description: f.description,
            mermaid_definition: f.mermaid_definition,
            flow_type: f.flow_type,
            metadata: f.metadata,
            created_at: f.created_at,
            updated_at: f.updated_at,
        }
    }
}

/// GraphQL output type for a single step within a Flow.
#[derive(SimpleObject)]
pub struct FlowStepType {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub screen_id: Option<Uuid>,
    pub component_id: Option<Uuid>,
    pub step_order: i32,
    pub label: Option<String>,
    pub description: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl From<crate::db::models::flow::FlowStep> for FlowStepType {
    fn from(s: crate::db::models::flow::FlowStep) -> Self {
        Self {
            id: s.id,
            flow_id: s.flow_id,
            screen_id: s.screen_id,
            component_id: s.component_id,
            step_order: s.step_order,
            label: s.label,
            description: s.description,
            metadata: s.metadata,
            created_at: s.created_at,
        }
    }
}

// ─── Input types ─────────────────────────────────────────────────────────────

#[derive(InputObject)]
pub struct CreateFlowInput {
    pub document_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub mermaid_definition: Option<String>,
    /// Defaults to "business" when omitted.
    pub flow_type: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateFlowInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub mermaid_definition: Option<String>,
}

#[derive(InputObject)]
pub struct CreateFlowStepInput {
    pub flow_id: Uuid,
    pub screen_id: Option<Uuid>,
    pub component_id: Option<Uuid>,
    pub step_order: i32,
    pub label: Option<String>,
    pub description: Option<String>,
}

// ─── Query ───────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct FlowQuery;

#[Object]
impl FlowQuery {
    /// List all flows belonging to a document.
    async fn flows(&self, ctx: &Context<'_>, document_id: Uuid) -> Result<Vec<FlowType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let flows = queries::list_flows(&gql_ctx.pool, document_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(flows.into_iter().map(|f| f.into()).collect())
    }

    /// Fetch a single flow by id.
    async fn flow(&self, ctx: &Context<'_>, id: Uuid) -> Result<Option<FlowType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let flow = queries::get_flow(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(flow.map(|f| f.into()))
    }
}

// ─── Mutation ────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct FlowMutation;

#[Object]
impl FlowMutation {
    /// Create a new flow for a document.
    async fn create_flow(&self, ctx: &Context<'_>, input: CreateFlowInput) -> Result<FlowType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let flow = queries::create_flow(
            &gql_ctx.pool,
            input.document_id,
            &input.name,
            input.description.as_deref(),
            input.mermaid_definition.as_deref(),
            input.flow_type.as_deref().unwrap_or("business"),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(flow.into())
    }

    /// Update mutable fields of a flow; omitted fields retain their current values.
    async fn update_flow(&self, ctx: &Context<'_>, input: UpdateFlowInput) -> Result<FlowType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let flow = queries::update_flow(
            &gql_ctx.pool,
            input.id,
            input.name.as_deref(),
            input.description.as_deref(),
            input.mermaid_definition.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(flow.into())
    }

    /// Delete a flow and all its steps (cascade). Returns true if deleted.
    async fn delete_flow(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_flow(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }

    /// Append a step to an existing flow.
    async fn create_flow_step(
        &self,
        ctx: &Context<'_>,
        input: CreateFlowStepInput,
    ) -> Result<FlowStepType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let step = queries::create_flow_step(
            &gql_ctx.pool,
            input.flow_id,
            input.screen_id,
            input.component_id,
            input.step_order,
            input.label.as_deref(),
            input.description.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(step.into())
    }

    /// Remove a single flow step by id. Returns true if deleted.
    async fn delete_flow_step(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_flow_step(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
