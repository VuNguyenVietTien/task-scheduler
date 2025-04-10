use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::db::queries::reports::{BugSeverity, BugStatus};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Bug {
    pub id: Uuid,
    pub task_id: Option<Uuid>,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub severity: BugSeverity,
    pub status: BugStatus,
    pub priority: Option<i32>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub date_discovered: NaiveDate,
    pub date_resolved: Option<NaiveDate>,
    pub resolution_time: Option<i32>,
    pub resolution_description: Option<String>,
    pub affected_components: Option<serde_json::Value>,
    pub tags: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FromRow<'_, PgRow> for Bug {
    fn from_row(row: &PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            task_id: row.try_get("task_id")?,
            project_id: row.try_get("project_id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            severity: row.try_get("severity")?,
            status: row.try_get("status")?,
            priority: row.try_get("priority")?,
            assignee_id: row.try_get("assignee_id")?,
            reporter_id: row.try_get("reporter_id")?,
            date_discovered: row.try_get("date_discovered")?,
            date_resolved: row.try_get("date_resolved")?,
            resolution_time: row.try_get("resolution_time")?,
            resolution_description: row.try_get("resolution_description")?,
            affected_components: row.try_get("affected_components")?,
            tags: row.try_get("tags")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}
