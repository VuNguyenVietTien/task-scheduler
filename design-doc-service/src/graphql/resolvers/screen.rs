use async_graphql::{Context, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::db::queries::component as component_queries;
use crate::db::queries::screen as queries;
use crate::db::queries::tag as tag_queries;
use crate::error::AppError;
use crate::graphql::context::GqlContext;
use crate::services::svg_service;

const VALID_CONTENT_TYPES: &[&str] = &["svg", "image"];

/// Validate content_type is "svg" or "image". Returns normalized value.
fn validate_content_type(ct: Option<&str>) -> std::result::Result<&str, AppError> {
    let ct = ct.unwrap_or("svg");
    if !VALID_CONTENT_TYPES.contains(&ct) {
        return Err(AppError::Validation(format!("Invalid content_type '{}'. Must be 'svg' or 'image'", ct)));
    }
    Ok(ct)
}

/// Validate image content: must be a data:image/ URL and under 5MB.
fn validate_image_content(content: &str) -> std::result::Result<(), AppError> {
    if content.len() > 5_000_000 {
        return Err(AppError::Validation("Image too large (max 5MB)".into()));
    }
    if !content.starts_with("data:image/") {
        return Err(AppError::Validation("Image content must be a data:image/ URL".into()));
    }
    Ok(())
}

/// GraphQL output type for a Screen entity
#[derive(SimpleObject)]
#[graphql(complex)]
pub struct ScreenType {
    pub id: Uuid,
    pub document_id: Uuid,
    pub name: String,
    pub svg_content: Option<String>,
    pub svg_layers: Option<serde_json::Value>,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
    pub content_type: String,
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
            svg_layers: s.svg_layers.clone(),
            frame_width: s.frame_width,
            frame_height: s.frame_height,
            content_type: s.content_type,
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
    /// "svg" (default) or "image"
    pub content_type: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateScreenInput {
    pub id: Uuid,
    pub name: Option<String>,
    pub svg_content: Option<String>,
    pub svg_layers: Option<serde_json::Value>,
    pub frame_width: Option<i32>,
    pub frame_height: Option<i32>,
    pub content_type: Option<String>,
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
        if let Some(ref ct) = input.content_type {
            validate_content_type(Some(ct.as_str()))
                .map_err(|e| e.into_graphql_error())?;
        }
        let is_image = input.content_type.as_deref() == Some("image");
        let svg_content = if let Some(ref svg) = input.svg_content {
            if is_image {
                validate_image_content(svg)
                    .map_err(|e| e.into_graphql_error())?;
                Some(svg.clone())
            } else {
                svg_service::validate_svg(svg, gql_ctx.config.max_svg_size)
                    .map_err(|e| e.into_graphql_error())?;
                Some(svg_service::sanitize_svg(svg))
            }
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
            input.content_type.as_deref(),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    /// Paste SVG or image from clipboard - creates a new screen with content
    async fn paste_design(
        &self,
        ctx: &Context<'_>,
        input: PasteDesignInput,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        let ct = validate_content_type(input.content_type.as_deref())
            .map_err(|e| e.into_graphql_error())?;
        let content = if ct == "image" {
            validate_image_content(&input.svg_content)
                .map_err(|e| e.into_graphql_error())?;
            input.svg_content.clone()
        } else {
            svg_service::validate_svg(&input.svg_content, gql_ctx.config.max_svg_size)
                .map_err(|e| e.into_graphql_error())?;
            svg_service::sanitize_svg(&input.svg_content)
        };
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::create_screen(
            &gql_ctx.pool,
            input.document_id,
            &input.screen_name,
            &input.breakpoint,
            None,
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::update_screen(
            &gql_ctx.pool,
            screen.id,
            None,
            Some(&content),
            Some(&input.svg_layers),
            input.frame_width,
            input.frame_height,
            Some(ct),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    /// Re-paste updated content - preserves existing component assignments
    async fn update_design_from_paste(
        &self,
        ctx: &Context<'_>,
        screen_id: Uuid,
        svg_content: String,
        svg_layers: serde_json::Value,
        content_type: Option<String>,
    ) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        let user_id = gql_ctx.user_id().map_err(|e| e.into_graphql_error())?;
        let ct = validate_content_type(content_type.as_deref())
            .map_err(|e| e.into_graphql_error())?;
        let content = if ct == "image" {
            validate_image_content(&svg_content)
                .map_err(|e| e.into_graphql_error())?;
            svg_content
        } else {
            svg_service::validate_svg(&svg_content, gql_ctx.config.max_svg_size)
                .map_err(|e| e.into_graphql_error())?;
            svg_service::sanitize_svg(&svg_content)
        };
        sqlx::query("SELECT set_config('app.user_id', $1::text, true)")
            .bind(user_id.to_string())
            .execute(&gql_ctx.pool)
            .await
            .map_err(|e| AppError::Database(e).into_graphql_error())?;
        let screen = queries::update_screen(
            &gql_ctx.pool,
            screen_id,
            None,
            Some(&content),
            Some(&svg_layers),
            None,
            None,
            Some(ct),
        )
        .await
        .map_err(|e| AppError::Database(e).into_graphql_error())?;
        Ok(screen.into())
    }

    /// Clear SVG content from a screen, allowing a new design to be pasted
    async fn clear_screen_design(&self, ctx: &Context<'_>, id: Uuid) -> Result<ScreenType> {
        let gql_ctx = ctx.data::<GqlContext>()?;
        gql_ctx.require_auth().map_err(|e| e.into_graphql_error())?;
        let screen = queries::clear_screen_design(&gql_ctx.pool, id)
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
