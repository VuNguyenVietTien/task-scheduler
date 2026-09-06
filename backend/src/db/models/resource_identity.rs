//! Database models for stable project resource identities (design doc §6.3).
//!
//! Mirrors `resource_members` / `resource_member_classifications` from
//! `20260901000300_create_resource_membership.sql`. Companies/groups are
//! classification rows only — never assignees or capacity pools.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Row of `resource_members`.
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ResourceMember {
    pub resource_member_id: Uuid,
    pub project_id: Uuid,
    pub display_name: String,
    pub email: Option<String>,
    /// NULL = placeholder. Linking preserves `resource_member_id`.
    pub user_id: Option<Uuid>,
    /// MEMBER | COMPANY | GROUP (TEXT + CHECK in SQL).
    pub member_kind: String,
    pub linked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row of `resource_member_classifications`: concrete MEMBER classified by a
/// COMPANY/GROUP of the same project. Classification/filtering only.
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct ResourceMemberClassification {
    pub resource_member_id: Uuid,
    pub classified_by_resource_member_id: Uuid,
    pub created_at: DateTime<Utc>,
}
