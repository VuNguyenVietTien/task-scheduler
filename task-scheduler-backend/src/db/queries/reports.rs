use crate::db::models::{Bug, Report, ReportTask};
use crate::db::types::{BugSeverity, BugStatus, ReportType, TaskStatus};
use chrono::{NaiveDate, Utc};
use serde_json::Value;
use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;

/// Lấy báo cáo theo ID
pub async fn get_report_by_id(
    pool: &PgPool,
    report_id: Uuid,
) -> Result<Option<Report>, sqlx::Error> {
    sqlx::query_as!(
        Report,
        r#"
        SELECT * FROM reports WHERE id = $1
        "#,
        report_id
    )
    .fetch_optional(pool)
    .await
}

/// Lấy danh sách báo cáo theo dự án và loại báo cáo
pub async fn get_reports_by_project(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<Report>, sqlx::Error> {
    sqlx::query_as!(
        Report,
        r#"
        SELECT * FROM reports 
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
}

/// Lấy tất cả các task của một báo cáo
pub async fn get_report_tasks(
    pool: &PgPool,
    report_id: Uuid,
) -> Result<Vec<ReportTask>, sqlx::Error> {
    sqlx::query_as!(
        ReportTask,
        r#"
        SELECT * FROM report_tasks WHERE report_id = $1
        "#,
        report_id
    )
    .fetch_all(pool)
    .await
}

/// Lấy tất cả các bug của một dự án
pub async fn get_bugs_by_project(pool: &PgPool, project_id: Uuid) -> Result<Vec<Bug>, sqlx::Error> {
    sqlx::query_as!(
        Bug,
        r#"
        SELECT * FROM bugs WHERE project_id = $1
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
}

/// Tạo báo cáo mới
pub async fn create_report(
    pool: &PgPool,
    report_type: ReportType,
    report_date: NaiveDate,
    project_id: Uuid,
    plan_id: Option<Uuid>,
    period_start_date: NaiveDate,
    period_end_date: NaiveDate,
    total_tasks: i32,
    completed_tasks: i32,
    delayed_tasks: i32,
    on_schedule_tasks: i32,
    new_started_tasks: i32,
    unassigned_resources: Option<Value>,
    total_bugs: i32,
    critical_bugs: i32,
    major_bugs: i32,
    minor_bugs: i32,
    resolved_bugs: i32,
    summary: Option<String>,
) -> Result<Report, sqlx::Error> {
    let now = Utc::now();

    sqlx::query_as!(
        Report,
        r#"
        INSERT INTO reports (
            report_type, report_date, project_id, plan_id, 
            period_start_date, period_end_date, total_tasks, 
            completed_tasks, delayed_tasks, on_schedule_tasks, 
            new_started_tasks, unassigned_resources, total_bugs, 
            critical_bugs, major_bugs, minor_bugs, resolved_bugs, 
            summary, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
        "#,
        report_type as ReportType,
        report_date,
        project_id,
        plan_id,
        period_start_date,
        period_end_date,
        total_tasks,
        completed_tasks,
        delayed_tasks,
        on_schedule_tasks,
        new_started_tasks,
        unassigned_resources as Option<Value>,
        total_bugs,
        critical_bugs,
        major_bugs,
        minor_bugs,
        resolved_bugs,
        summary,
        now,
        now
    )
    .fetch_one(pool)
    .await
}

/// Cập nhật báo cáo
pub async fn update_report(
    pool: &PgPool,
    report_id: Uuid,
    report_type: Option<ReportType>,
    report_date: Option<NaiveDate>,
    plan_id: Option<Uuid>,
    period_start_date: Option<NaiveDate>,
    period_end_date: Option<NaiveDate>,
    total_tasks: Option<i32>,
    completed_tasks: Option<i32>,
    delayed_tasks: Option<i32>,
    on_schedule_tasks: Option<i32>,
    new_started_tasks: Option<i32>,
    unassigned_resources: Option<Value>,
    total_bugs: Option<i32>,
    critical_bugs: Option<i32>,
    major_bugs: Option<i32>,
    minor_bugs: Option<i32>,
    resolved_bugs: Option<i32>,
    summary: Option<String>,
) -> Result<Report, sqlx::Error> {
    let report = get_report_by_id(pool, report_id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    let now = Utc::now();

    sqlx::query_as!(
        Report,
        r#"
        UPDATE reports
        SET
            report_type = $1,
            report_date = $2,
            plan_id = $3,
            period_start_date = $4,
            period_end_date = $5,
            total_tasks = $6,
            completed_tasks = $7,
            delayed_tasks = $8,
            on_schedule_tasks = $9,
            new_started_tasks = $10,
            unassigned_resources = $11,
            total_bugs = $12,
            critical_bugs = $13,
            major_bugs = $14,
            minor_bugs = $15,
            resolved_bugs = $16,
            summary = $17,
            updated_at = $18
        WHERE id = $19
        RETURNING *
        "#,
        report_type.unwrap_or(report.report_type) as ReportType,
        report_date.unwrap_or(report.report_date),
        plan_id.or(report.plan_id),
        period_start_date.unwrap_or(report.period_start_date),
        period_end_date.unwrap_or(report.period_end_date),
        total_tasks.unwrap_or(report.total_tasks),
        completed_tasks.unwrap_or(report.completed_tasks),
        delayed_tasks.unwrap_or(report.delayed_tasks),
        on_schedule_tasks.unwrap_or(report.on_schedule_tasks),
        new_started_tasks.unwrap_or(report.new_started_tasks),
        unassigned_resources.or(report.unassigned_resources) as Option<Value>,
        total_bugs.unwrap_or(report.total_bugs),
        critical_bugs.unwrap_or(report.critical_bugs),
        major_bugs.unwrap_or(report.major_bugs),
        minor_bugs.unwrap_or(report.minor_bugs),
        resolved_bugs.unwrap_or(report.resolved_bugs),
        summary.or(report.summary),
        now,
        report_id
    )
    .fetch_one(pool)
    .await
}

/// Tạo report_task
pub async fn create_report_task(
    pool: &PgPool,
    report_id: Uuid,
    task_id: Uuid,
    task_title: String,
    assignee_id: Option<Uuid>,
    planned_start_date: Option<chrono::DateTime<Utc>>,
    planned_end_date: Option<chrono::DateTime<Utc>>,
    actual_start_date: Option<chrono::DateTime<Utc>>,
    actual_end_date: Option<chrono::DateTime<Utc>>,
    status: TaskStatus,
    is_delayed: bool,
    delay_reason: Option<String>,
    remarks: Option<String>,
) -> Result<ReportTask, sqlx::Error> {
    let now = Utc::now();

    sqlx::query_as!(
        ReportTask,
        r#"
        INSERT INTO report_tasks (
            report_id, task_id, task_title, assignee_id,
            planned_start_date, planned_end_date, actual_start_date, actual_end_date,
            status, is_delayed, delay_reason, remarks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        "#,
        report_id,
        task_id,
        task_title,
        assignee_id,
        planned_start_date,
        planned_end_date,
        actual_start_date,
        actual_end_date,
        status as TaskStatus,
        is_delayed,
        delay_reason,
        remarks,
        now
    )
    .fetch_one(pool)
    .await
}

/// Tạo bug
pub async fn create_bug(
    pool: &PgPool,
    task_id: Option<Uuid>,
    project_id: Uuid,
    title: String,
    description: Option<String>,
    severity: BugSeverity,
    status: BugStatus,
    priority: Option<i32>,
    assignee_id: Option<Uuid>,
    reporter_id: Option<Uuid>,
    date_discovered: NaiveDate,
    date_resolved: Option<NaiveDate>,
    resolution_time: Option<i32>,
    resolution_description: Option<String>,
    affected_components: Option<Value>,
    tags: Option<Value>,
) -> Result<Bug, sqlx::Error> {
    let now = Utc::now();

    let bug = sqlx::query(
        r#"
        INSERT INTO bugs (
            task_id, project_id, title, description, severity, 
            status, priority, assignee_id, reporter_id, 
            date_discovered, date_resolved, resolution_time, 
            resolution_description, affected_components, tags, 
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
        "#
    )
    .bind(task_id)
    .bind(project_id)
    .bind(title)
    .bind(description)
    .bind(severity)
    .bind(status)
    .bind(priority)
    .bind(assignee_id)
    .bind(reporter_id)
    .bind(date_discovered)
    .bind(date_resolved)
    .bind(resolution_time)
    .bind(resolution_description)
    .bind(affected_components)
    .bind(tags)
    .bind(now)
    .bind(now)
    .map(|row: PgRow| {
        Ok(Bug {
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
    })
    .fetch_one(pool)
    .await?;

    bug
}
