//! Taxonomy (phase/category) GraphQL resolvers — project scheduling & WBS
//! increment 1, task 1.1 foundation.
//!
//! STATUS: authored but NOT yet mounted. `backend/src/graphql/resolvers/mod.rs`
//! and `backend/src/graphql/schema.rs` are owned by task 1.3 (GraphQL
//! composition); until then this module is intentionally not referenced and
//! therefore not compiled. Task 1.3 mounts it by adding
//! `pub mod taxonomies;` + re-exports and folding `TaxonomyQuery` /
//! `TaxonomyMutation` into the schema roots, then locking the SDL in
//! `backend/schema.graphql` via the contract test.
//!
//! Behavior contracts (design doc §4) implemented through
//! `crate::domain::taxonomy`: project-scoped CRUD, exact five-phase seed,
//! locale fallback (requested → project default → first → key), archive with
//! atomic reassignment or explicit Unphased, and task phase/category
//! assignment validated against the owning project.

use async_graphql::{Context, ID, Object, Result};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::domain::taxonomy::{
    self, ArchiveStrategy, LocalizedLabel, PhaseRow, TaxonomyError,
};
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string()).map_err(|e| async_graphql::Error::new(format!("invalid {field}: {e}")))
}

fn map_err(e: TaxonomyError) -> async_graphql::Error {
    async_graphql::Error::new(e.to_string())
}

/* --------------------------------- types --------------------------------- */

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct PhaseTranslationType {
    pub locale: String,
    pub name: String,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectPhaseType {
    pub phase_id: ID,
    pub project_id: ID,
    pub phase_key: String,
    pub display_order: i32,
    pub is_active: bool,
    pub translations: Vec<PhaseTranslationType>,
}

impl From<PhaseRow> for ProjectPhaseType {
    fn from(row: PhaseRow) -> Self {
        Self {
            phase_id: row.phase_id.into(),
            project_id: Uuid::default().into(), // filled by the loader below
            phase_key: row.phase_key,
            display_order: row.display_order,
            is_active: row.is_active,
            translations: row
                .translations
                .into_iter()
                .map(|LocalizedLabel { locale, name }| PhaseTranslationType { locale, name })
                .collect(),
        }
    }
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TranslationInput {
    pub locale: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CreateTermInput {
    pub project_id: ID,
    pub term_key: String,
    pub display_order: i32,
    pub color: Option<String>,
    pub translations: Vec<TranslationInput>,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdateTermTranslationsInput {
    pub project_id: ID,
    pub term_id: ID,
    pub display_order: Option<i32>,
    pub color: Option<String>,
    pub translations: Option<Vec<TranslationInput>>,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ArchiveStrategyInput {
    /// Atomically move every referencing task to this active term.
    pub reassign_to: Option<ID>,
    /// Explicit Unphased conversion: referencing tasks lose the attribute.
    /// Exactly one of `reassign_to` / `unphased` must be set.
    pub unphased: Option<bool>,
}

/* --------------------------------- queries --------------------------------- */

#[derive(Default)]
pub struct TaxonomyQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TaxonomyQuery {
    /// A project's phases in display order with all translations.
    async fn project_phases(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        include_archived: Option<bool>,
    ) -> Result<Vec<ProjectPhaseType>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let rows = taxonomy::list_project_phases(&context.db, project_id)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        Ok(rows
            .into_iter()
            .filter(|r| include_archived.unwrap_or(false) || r.is_active)
            .map(|row| {
                let mut typed: ProjectPhaseType = row.into();
                typed.project_id = project_id.into();
                typed
            })
            .collect())
    }
}

/* -------------------------------- mutations -------------------------------- */

#[derive(Default)]
pub struct TaxonomyMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TaxonomyMutation {
    /// (Re-)apply the exact five default phases (idempotent; seeds new
    /// projects, verifies existing ones).
    async fn ensure_default_phases(&self, ctx: &Context<'_>, project_id: ID) -> Result<i32> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_write(&context.db, user_id, project_id).await?;
        let inserted = taxonomy::ensure_default_phases(&context.db, project_id)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        Ok(inserted as i32)
    }

    /// Create a project phase (project-local key/order uniqueness enforced).
    async fn create_project_phase(&self, ctx: &Context<'_>, input: CreateTermInput) -> Result<ProjectPhaseType> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_write(pool, user_id, project_id).await?;
        let mut tx = pool.begin().await.map_err(AuthError::Database)?;
        let phase_id: Uuid = sqlx::query_scalar(
            "INSERT INTO project_phases (project_id, phase_key, display_order, color) \
             VALUES ($1, $2, $3, $4) RETURNING phase_id",
        )
        .bind(project_id)
        .bind(&input.term_key)
        .bind(input.display_order)
        .bind(input.color.as_deref())
        .fetch_one(&mut *tx)
        .await
        .map_err(TaxonomyError::from).map_err(map_err)?;
        for t in &input.translations {
            sqlx::query(
                "INSERT INTO project_phase_translations (phase_id, locale, name, description) \
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(phase_id)
            .bind(&t.locale)
            .bind(&t.name)
            .bind(t.description.as_deref())
            .execute(&mut *tx)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        }
        tx.commit().await.map_err(TaxonomyError::from).map_err(map_err)?;
        let rows = taxonomy::list_project_phases(pool, project_id).await.map_err(TaxonomyError::from).map_err(map_err)?;
        let row = rows
            .into_iter()
            .find(|r| r.phase_id == phase_id)
            .ok_or_else(|| async_graphql::Error::new("created phase not found"))?;
        let mut typed: ProjectPhaseType = row.into();
        typed.project_id = project_id.into();
        Ok(typed)
    }

    /// Edit a phase's order/color/translations (labels are never identifiers).
    async fn update_project_phase_translations(
        &self,
        ctx: &Context<'_>,
        input: UpdateTermTranslationsInput,
    ) -> Result<ProjectPhaseType> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let phase_id = parse_id(&input.term_id, "term_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_write(pool, user_id, project_id).await?;
        let mut tx = pool.begin().await.map_err(AuthError::Database)?;
        sqlx::query(
            "UPDATE project_phases SET display_order = COALESCE($2, display_order), \
             color = COALESCE($3, color), updated_at = now() \
             WHERE phase_id = $1 AND project_id = $4",
        )
        .bind(phase_id)
        .bind(input.display_order)
        .bind(input.color.as_deref())
        .bind(project_id)
        .execute(&mut *tx)
        .await
        .map_err(TaxonomyError::from).map_err(map_err)?;
        if let Some(translations) = input.translations {
            sqlx::query("DELETE FROM project_phase_translations WHERE phase_id = $1")
                .bind(phase_id)
                .execute(&mut *tx)
                .await
                .map_err(TaxonomyError::from).map_err(map_err)?;
            for t in &translations {
                sqlx::query(
                    "INSERT INTO project_phase_translations (phase_id, locale, name, description) \
                     VALUES ($1, $2, $3, $4)",
                )
                .bind(phase_id)
                .bind(&t.locale)
                .bind(&t.name)
                .bind(t.description.as_deref())
                .execute(&mut *tx)
                .await
                .map_err(TaxonomyError::from).map_err(map_err)?;
            }
        }
        tx.commit().await.map_err(TaxonomyError::from).map_err(map_err)?;
        let rows = taxonomy::list_project_phases(pool, project_id).await.map_err(TaxonomyError::from).map_err(map_err)?;
        let row = rows
            .into_iter()
            .find(|r| r.phase_id == phase_id)
            .ok_or_else(|| async_graphql::Error::new("phase not found for this project"))?;
        let mut typed: ProjectPhaseType = row.into();
        typed.project_id = project_id.into();
        Ok(typed)
    }

    /// Archive a phase. Referencing tasks must be atomically reassigned or
    /// explicitly converted to Unphased (ArchiveStrategyInput).
    async fn archive_project_phase(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        phase_id: ID,
        strategy: ArchiveStrategyInput,
    ) -> Result<i32> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let phase_id = parse_id(&phase_id, "phase_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_write(&context.db, user_id, project_id).await?;
        let strategy = match (strategy.reassign_to, strategy.unphased) {
            (Some(target), None) => {
                ArchiveStrategy::ReassignTo(&parse_id(&target, "target phase_id")?)
            }
            (None, Some(true)) => ArchiveStrategy::Unphased,
            _ => {
                return Err(async_graphql::Error::new(
                    "archive requires exactly one strategy: reassign_to or unphased",
                ))
            }
        };
        let converted = taxonomy::archive_phase(&context.db, project_id, phase_id, strategy)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        Ok(converted as i32)
    }

    /// Assign a task's phase/category. Both terms must belong to the task's
    /// project and be active; NULL explicitly means Unphased/uncategorised.
    async fn set_task_taxonomy(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        phase_id: Option<ID>,
        category_id: Option<ID>,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = parse_id(&task_id, "task_id")?;
        let user_id = project_authz::require_user(context)?;
        let phase_id = phase_id.map(|id| parse_id(&id, "phase_id")).transpose()?;
        let category_id = category_id.map(|id| parse_id(&id, "category_id")).transpose()?;
        let project_row: Option<(Uuid,)> = sqlx::query_as(
            "SELECT project_id FROM tasks WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
        )
        .bind(task_id)
        .fetch_optional(pool)
        .await
        .map_err(TaxonomyError::from).map_err(map_err)?;
        let project_id = project_row
            .ok_or_else(|| async_graphql::Error::new("Task not found"))?
            .0;
        project_authz::require_project_write(pool, user_id, project_id).await?;
        taxonomy::validate_term_for_project(pool, project_id, phase_id, category_id)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        sqlx::query("UPDATE tasks SET phase_id = $2, category_id = $3, updated_at = now() WHERE task_id = $1")
            .bind(task_id)
            .bind(phase_id)
            .bind(category_id)
            .execute(pool)
            .await
            .map_err(TaxonomyError::from).map_err(map_err)?;
        Ok(true)
    }
}
