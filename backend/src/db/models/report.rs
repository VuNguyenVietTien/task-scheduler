use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::db::enums::TaskStatus;
use crate::db::queries::reports::ReportType;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Report {
    pub id: Uuid,
    pub report_type: ReportType,
    pub report_date: NaiveDate,
    pub project_id: Uuid,
    pub plan_id: Option<Uuid>,
    pub period_start_date: NaiveDate,
    pub period_end_date: NaiveDate,
    pub total_tasks: i32,
    pub completed_tasks: i32,
    pub delayed_tasks: i32,
    pub on_schedule_tasks: i32,
    pub new_started_tasks: i32,
    pub unassigned_resources: Option<serde_json::Value>,
    pub total_bugs: i32,
    pub critical_bugs: i32,
    pub major_bugs: i32,
    pub minor_bugs: i32,
    pub resolved_bugs: i32,
    pub rejected_tasks: i32,
    pub on_schedule_percentage: Option<f64>,
    pub delay_percentage: Option<f64>,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FromRow<'_, PgRow> for Report {
    fn from_row(row: &PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            report_type: row.try_get("report_type")?,
            report_date: row.try_get("report_date")?,
            project_id: row.try_get("project_id")?,
            plan_id: row.try_get("plan_id")?,
            period_start_date: row.try_get("period_start_date")?,
            period_end_date: row.try_get("period_end_date")?,
            total_tasks: row.try_get("total_tasks")?,
            completed_tasks: row.try_get("completed_tasks")?,
            delayed_tasks: row.try_get("delayed_tasks")?,
            on_schedule_tasks: row.try_get("on_schedule_tasks")?,
            new_started_tasks: row.try_get("new_started_tasks")?,
            unassigned_resources: row.try_get("unassigned_resources")?,
            total_bugs: row.try_get("total_bugs")?,
            critical_bugs: row.try_get("critical_bugs")?,
            major_bugs: row.try_get("major_bugs")?,
            minor_bugs: row.try_get("minor_bugs")?,
            resolved_bugs: row.try_get("resolved_bugs")?,
            rejected_tasks: row.try_get("rejected_tasks")?,
            on_schedule_percentage: row.try_get("on_schedule_percentage")?,
            delay_percentage: row.try_get("delay_percentage")?,
            summary: row.try_get("summary")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}
