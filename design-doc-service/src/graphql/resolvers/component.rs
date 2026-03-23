use async_graphql::{ComplexObject, Context, InputObject, Object, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::{component as component_q, field_mapping as fm_q, tag as tag_q};
use crate::error::AppError;
use crate::graphql::context::GqlContext;
use crate::graphql::resolvers::field_mapping::FieldMappingType;
use crate::graphql::resolvers::tag::TagType;

// ── GraphQL output type ───────────────────────────────────────────────────────

#[derive(SimpleObject, Clone)]
#[graphql(complex)]
pub struct ComponentType {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub custom_id: String,
    pub name: String,
    pub component_type: Option<String>,
    pub data_type: Option<String>,
    pub display_logic: Option<String>,
    /// JSON object: { x, y, width, height }
    pub position: serde_json::Value,
    pub svg_element_id: Option<String>,
    /// JSON object with arbitrary description keys
    pub descriptions: serde_json::Value,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[ComplexObject]
impl ComponentType {
    /// Lazy-load field mappings for this component.
    async fn field_mappings(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<FieldMappingType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let mappings = fm_q::list_field_mappings(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(mappings.into_iter().map(FieldMappingType::from).collect())
    }

    /// Lazy-load tags attached to this component.
    async fn tags(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let tags = tag_q::get_entity_tags(&gql_ctx.pool, "component", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(TagType::from).collect())
    }
}

impl From<crate::db::models::component::Component> for ComponentType {
    fn from(c: crate::db::models::component::Component) -> Self {
        Self {
            id: c.id,
            screen_id: c.screen_id,
            custom_id: c.custom_id,
            name: c.name,
            component_type: c.component_type,
            data_type: c.data_type,
            display_logic: c.display_logic,
            position: c.position,
            svg_element_id: c.svg_element_id,
            descriptions: c.descriptions,
            sort_order: c.sort_order,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }
    }
}

// ── Input types ───────────────────────────────────────────────────────────────

#[derive(InputObject)]
pub struct CreateComponentInput {
    pub screen_id: Uuid,
    pub custom_id: String,
    pub name: String,
    pub component_type: Option<String>,
    pub data_type: Option<String>,
    pub display_logic: Option<String>,
    /// JSON position object: { "x": 0, "y": 0, "width": 100, "height": 40 }
    pub position: serde_json::Value,
    pub svg_element_id: Option<String>,
    /// JSON descriptions object
    pub descriptions: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(InputObject)]
pub struct UpdateComponentInput {
    pub id: Uuid,
    pub custom_id: Option<String>,
    pub name: Option<String>,
    pub component_type: Option<String>,
    pub data_type: Option<String>,
    pub display_logic: Option<String>,
    pub position: Option<serde_json::Value>,
    pub svg_element_id: Option<String>,
    pub descriptions: Option<serde_json::Value>,
}

#[derive(InputObject)]
pub struct CreateFieldMappingInput {
    pub component_id: Uuid,
    pub db_table: String,
    pub db_column: String,
    pub description: Option<String>,
}

// ── Query ─────────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct ComponentQuery;

#[Object]
impl ComponentQuery {
    /// List all components belonging to a screen.
    async fn components(
        &self,
        ctx: &Context<'_>,
        screen_id: Uuid,
    ) -> async_graphql::Result<Vec<ComponentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        let components = component_q::list_components(&gql_ctx.pool, screen_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;

        Ok(components.into_iter().map(ComponentType::from).collect())
    }

    /// Fetch a single component by ID.
    async fn component(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<ComponentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        let component = component_q::get_component(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;

        Ok(component.map(ComponentType::from))
    }
}

// ── Mutation ──────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct ComponentMutation;

#[Object]
impl ComponentMutation {
    /// Create a new component on a screen.
    async fn create_component(
        &self,
        ctx: &Context<'_>,
        input: CreateComponentInput,
    ) -> async_graphql::Result<ComponentType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        let component = component_q::create_component(
            &gql_ctx.pool,
            input.screen_id,
            &input.custom_id,
            &input.name,
            input.component_type.as_deref(),
            input.data_type.as_deref(),
            input.display_logic.as_deref(),
            &input.position,
            input.svg_element_id.as_deref(),
            input.descriptions.as_ref(),
            input.sort_order,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;

        Ok(ComponentType::from(component))
    }

    /// Update an existing component's fields (all optional except id).
    async fn update_component(
        &self,
        ctx: &Context<'_>,
        input: UpdateComponentInput,
    ) -> async_graphql::Result<ComponentType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        // Verify component exists before update
        component_q::get_component(&gql_ctx.pool, input.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?
            .ok_or_else(|| AppError::NotFound(format!("Component {} not found", input.id)).into_graphql_error())?;

        let component = component_q::update_component(
            &gql_ctx.pool,
            input.id,
            input.custom_id.as_deref(),
            input.name.as_deref(),
            input.component_type.as_deref(),
            input.data_type.as_deref(),
            input.display_logic.as_deref(),
            input.position.as_ref(),
            input.svg_element_id.as_deref(),
            input.descriptions.as_ref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;

        Ok(ComponentType::from(component))
    }

    /// Delete a component by ID. Returns true if deleted.
    async fn delete_component(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        component_q::delete_component(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }

    /// Add a field mapping (db_table + db_column) to a component.
    async fn create_field_mapping(
        &self,
        ctx: &Context<'_>,
        input: CreateFieldMappingInput,
    ) -> async_graphql::Result<FieldMappingType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        let mapping = fm_q::create_field_mapping(
            &gql_ctx.pool,
            input.component_id,
            &input.db_table,
            &input.db_column,
            input.description.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;

        Ok(FieldMappingType::from(mapping))
    }

    /// Delete a field mapping by ID. Returns true if deleted.
    async fn delete_field_mapping(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;

        fm_q::delete_field_mapping(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
