use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::db::types::TaskStatus;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReportTask {
    pub id: Uuid,
    pub report_id: Uuid,
    pub task_id: Uuid,
    pub task_title: String,
    pub assignee_id: Option<Uuid>,
    pub planned_start_date: Option<DateTime<Utc>>,
    pub planned_end_date: Option<DateTime<Utc>>,
    pub actual_start_date: Option<DateTime<Utc>>,
    pub actual_end_date: Option<DateTime<Utc>>,
    pub status: TaskStatus,
    pub is_delayed: bool,
    pub delay_reason: Option<String>,
    pub remarks: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl FromRow<'_, PgRow> for ReportTask {
    fn from_row(row: &PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            report_id: row.try_get("report_id")?,
            task_id: row.try_get("task_id")?,
            task_title: row.try_get("task_title")?,
            assignee_id: row.try_get("assignee_id")?,
            planned_start_date: row.try_get("planned_start_date")?,
            planned_end_date: row.try_get("planned_end_date")?,
            actual_start_date: row.try_get("actual_start_date")?,
            actual_end_date: row.try_get("actual_end_date")?,
            status: row.try_get("status")?,
            is_delayed: row.try_get("is_delayed")?,
            delay_reason: row.try_get("delay_reason")?,
            remarks: row.try_get("remarks")?,
            created_at: row.try_get("created_at")?,
        })
    }
}
