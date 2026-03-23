use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::component as component_queries;
use crate::db::queries::screen as queries;
use crate::db::queries::tag as tag_queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;
use crate::services::svg_service;

/// GraphQL output type for a Screen entity
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct ScreenType {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub svg_content: Option<String>,
    pub svg_layers: serde_json::Value,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
    pub breakpoint: String,
    pub sort_order: i32,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[async_graphql::ComplexObject]
impl ScreenType {
    /// Components mapped on this screen's SVG
    async fn components(
        &self,
        ctx: &Context<'_>,
    ) -> Result<Vec<super::component::ComponentType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let components = component_queries::list_components(&gql_ctx.pool, self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(components.into_iter().map(|c| c.into()).collect())
    }

    async fn tags(&self, ctx: &Context<'_>) -> Result<Vec<super::tag::TagType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let tags = tag_queries::get_entity_tags(&gql_ctx.pool, "screen", self.id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(tags.into_iter().map(|t| t.into()).collect())
    }
}

impl From<crate::db::models::screen::Screen> for ScreenType {
    fn from(s: crate::db::models::screen::Screen) -> Self {
        Self {
            id: s.id,
            document_id: s.document_id,
            name: s.name,
            svg_content: s.svg_content,
            svg_layers: s.svg_layers,
            frame_width: s.frame_width,
            frame_height: s.frame_height,
            breakpoint: s.breakpoint,
            sort_order: s.sort_order,
            metadata: s.metadata,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

#[derive(InputObject)]
pub struct CreateScreenInput {
    pub document_id: Uuid,
    pub name: String,
    pub breakpoint: String,
    pub sort_order: Option<i32>,
}

#[derive(InputObject)]
pub struct PasteDesignInput {
    pub document_id: Uuid,
    pub screen_name: String,
    pub svg_content: String,
    pub svg_layers: serde_json::Value,
    pub breakpoint: String,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
}

#[derive(InputObject)]
pub struct UpdateScreenInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub svg_content: Option<String>,
    pub svg_layers: Option<serde_json::Value>,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
}

#[derive(Default)]
pub struct ScreenQuery;

#[Object]
impl ScreenQuery {
    async fn screens(&self, ctx: &Context<'_>, document_id: Uuid) -> Result<Vec<ScreenType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let screens = queries::list_screens(&gql_ctx.pool, document_id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screens.into_iter().map(|s| s.into()).collect())
    }

    async fn screen(&self, ctx: &Context<'_>, id: Uuid) -> Result<Option<ScreenType>> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let screen = queries::get_screen(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.map(|s| s.into()))
    }
}

#[derive(Default)]
pub struct ScreenMutation;

#[Object]
impl ScreenMutation {
    async fn create_screen(
        &self,
        ctx: &Context<'_>,
        input: CreateScreenInput,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::create_screen(
            &gql_ctx.pool,
            input.document_id,
            &input.name,
            &input.breakpoint,
            input.sort_order,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    async fn update_screen(
        &self,
        ctx: &Context<'_>,
        input: UpdateScreenInput,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        // Sanitize SVG if provided
        let svg_content = if let Some(ref svg) = input.svg_content {
            svg_service::validate_svg(svg, gql_ctx.config.max_svg_size)
                .map_err(|e| e.into_graphql_error())?;
            Some(svg_service::sanitize_svg(svg))
        } else {
            None
        };
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::update_screen(
            &gql_ctx.pool,
            input.id,
            input.name.as_deref(),
            svg_content.as_deref(),
            input.svg_layers.as_ref(),
            input.frame_width,
            input.frame_height,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    /// Paste SVG from clipboard - creates a new screen with SVG content
    async fn paste_design(
        &self,
        ctx: &Context<'_>,
        input: PasteDesignInput,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        // Validate and sanitize SVG
        svg_service::validate_svg(&input.svg_content, gql_ctx.config.max_svg_size)
            .map_err(|e| e.into_graphql_error())?;
        let sanitized = svg_service::sanitize_svg(&input.svg_content);
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        // Create screen
        let screen = queries::create_screen(
            &gql_ctx.pool,
            input.document_id,
            &input.screen_name,
            &input.breakpoint,
            None,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        // Update with SVG content
        let screen = queries::update_screen(
            &gql_ctx.pool,
            screen.id,
            None,
            Some(&sanitized),
            Some(&input.svg_layers),
            input.frame_width,
            input.frame_height,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    /// Re-paste updated SVG - preserves existing component assignments
    async fn update_design_from_paste(
        &self,
        ctx: &Context<'_>,
        screen_id: Uuid,
        svg_content: String,
        svg_layers: serde_json::Value,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        svg_service::validate_svg(&svg_content, gql_ctx.config.max_svg_size)
            .map_err(|e| e.into_graphql_error())?;
        let sanitized = svg_service::sanitize_svg(&svg_content);
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::update_screen(
            &gql_ctx.pool,
            screen_id,
            None,
            Some(&sanitized),
            Some(&svg_layers),
            None,
            None,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    async fn delete_screen(&self, ctx: &Context<'_>, id: Uuid) -> Result<bool> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        queries::delete_screen(&gql_ctx.pool, id)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())
    }
}
