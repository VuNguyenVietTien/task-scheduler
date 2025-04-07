use async_graphql::{InputObject, SimpleObject};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::db::types::{BugSeverity, BugStatus};
use crate::db::models::{report, report_task, bug};

#[derive(SimpleObject)]
pub struct User {
    pub user_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: Option<i32>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_time: Option<i32>,
    pub completed_time: Option<i32>,
    pub progress: Option<i32>,
    pub tags: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
pub struct ReportTask {
    pub id: Uuid,
    pub report_id: Uuid,
    pub task_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(SimpleObject, Debug, Clone, Serialize, Deserialize)]
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
    pub affected_components: Option<Value>,
    pub tags: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(InputObject)]
pub struct CreateReportInput {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i32>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_time: Option<i32>,
    pub tags: Option<Value>,
}

#[derive(InputObject)]
pub struct UpdateReportInput {
    pub id: Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i32>,
    pub assignee_id: Option<Uuid>,
    pub reporter_id: Option<Uuid>,
    pub start_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub estimated_time: Option<i32>,
    pub completed_time: Option<i32>,
    pub progress: Option<i32>,
    pub tags: Option<Value>,
}

#[derive(InputObject)]
pub struct CreateReportTaskInput {
    pub report_id: Uuid,
    pub task_id: Uuid,
}

#[derive(InputObject)]
pub struct CreateBugInput {
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
    pub affected_components: Option<Value>,
    pub tags: Option<Value>,
}

impl From<report::Report> for Report {
    fn from(db_report: report::Report) -> Self {
        Self {
            id: db_report.id,
            project_id: db_report.project_id,
            title: db_report.summary.unwrap_or_else(|| "Untitled Report".to_string()),
            description: None,
            status: "Draft".to_string(),
            priority: None,
            assignee_id: None,
            reporter_id: None,
            start_date: Some(db_report.period_start_date),
            due_date: Some(db_report.period_end_date),
            estimated_time: None,
            completed_time: None,
            progress: None,
            tags: None,
            created_at: db_report.created_at,
            updated_at: db_report.updated_at,
        }
    }
}

impl From<report_task::ReportTask> for ReportTask {
    fn from(db_task: report_task::ReportTask) -> Self {
        Self {
            id: db_task.id,
            report_id: db_task.report_id,
            task_id: db_task.task_id,
            created_at: db_task.created_at,
            updated_at: db_task.created_at, // Use created_at as updated_at since the DB model doesn't have it
        }
    }
}

impl From<bug::Bug> for Bug {
    fn from(db_bug: bug::Bug) -> Self {
        Self {
            id: db_bug.id,
            task_id: db_bug.task_id,
            project_id: db_bug.project_id,
            title: db_bug.title,
            description: db_bug.description,
            severity: db_bug.severity,
            status: db_bug.status,
            priority: db_bug.priority,
            assignee_id: db_bug.assignee_id,
            reporter_id: db_bug.reporter_id,
            date_discovered: db_bug.date_discovered,
            date_resolved: db_bug.date_resolved,
            resolution_time: db_bug.resolution_time,
            resolution_description: db_bug.resolution_description,
            affected_components: db_bug.affected_components,
            tags: db_bug.tags,
            created_at: db_bug.created_at,
            updated_at: db_bug.updated_at,
        }
    }
}
