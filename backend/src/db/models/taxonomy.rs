//! Database models for project-scoped taxonomy terms (phases/categories).
//!
//! Task 1.1 (design doc §4): these rows are pure taxonomy — project-local
//! key/order uniqueness, translations, archive flag. No effort, progress,
//! dates, assignee, parent, dependency, meeting, or allocation semantics.

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ProjectPhase {
    pub phase_id: Uuid,
    pub project_id: Uuid,
    pub phase_key: String,
    pub display_order: i32,
    pub color: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ProjectPhaseTranslation {
    pub phase_id: Uuid,
    pub locale: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ProjectCategory {
    pub category_id: Uuid,
    pub project_id: Uuid,
    pub category_key: String,
    pub display_order: i32,
    pub color: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ProjectCategoryTranslation {
    pub category_id: Uuid,
    pub locale: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}
