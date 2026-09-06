//! Schedule projection + import dry-run GraphQL resolvers — Increment 1,
//! task 1.3 (schema composition).
//!
//! Mounts the PURE current-field projector (owned path
//! `src/scheduling/projection.rs`) via a `#[path]` module declaration so
//! `lib.rs`/`main.rs` need no edits in this task, and exposes the
//! issue-1115 dry-run manifest as a read-only query (DryRunReport gates:
//! 23 headings / 156 tasks / 69-69-6-6-6 / 387.00h / issue-1139 checks,
//! snapshot digest via `manifest::canonical_snapshot`).
//!
//! NO capacity/allocation/meeting/schedule-engine dependency.

// Pure projection logic lives at the task-owned path `src/scheduling/projection.rs`.
#[path = "../../../scheduling/projection.rs"]
pub mod projection;

use async_graphql::{Context, ID, Object, Result, Union};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
use self::imports::issue_1115::{self, DryRunReport};
use self::imports::manifest::{self, ImportManifest};

mod imports;

use projection::{HeadingRow, PhaseOrderRow, ProjectionOutput, TaskFieldRow};

/* ------------------------------ projection types ------------------------------ */

#[derive(async_graphql::Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ScheduleProjectionSource {
    /// Increment 1 producer: current task dates/effort/progress fields.
    #[graphql(name = "CURRENT_TASK_FIELDS")]
    CurrentTaskFields,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ScheduleTotals {
    pub task_count: i32,
    /// Normalized display decimal string (e.g. "387.00").
    pub effort_hours: String,
    pub progress: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

impl From<projection::ScheduleTotals> for ScheduleTotals {
    fn from(t: projection::ScheduleTotals) -> Self {
        Self {
            task_count: t.task_count as i32,
            effort_hours: t.effort_hours,
            progress: t.progress,
            start_date: t.start_date,
            end_date: t.end_date,
        }
    }
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct SchedulePhaseGroup {
    pub phase_id: Option<ID>,
    pub phase_key: String,
    pub is_unphased: bool,
    pub task_ids: Vec<ID>,
    pub totals: ScheduleTotals,
}

/// A real task row. Carries the bar-relevant current fields.
#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ScheduleTaskEntry {
    pub task_id: ID,
    pub title: String,
    pub phase_id: Option<ID>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub effort_hours: String,
    pub progress: Option<f64>,
    pub depth: i32,
}

/// Source WBS heading row: DISTINCT object with NO task identity, NO bar
/// callbacks, NO schedule numbers. Display/provenance metadata only.
#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ScheduleSourceHeading {
    pub heading_id: ID,
    pub source_system: String,
    pub external_id: String,
    pub title: String,
    pub depth: i32,
}

#[derive(Union)]
pub enum ScheduleWbsRow {
    Task(ScheduleTaskEntry),
    Heading(ScheduleSourceHeading),
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ProjectScheduleProjection {
    pub project_id: ID,
    pub source: ScheduleProjectionSource,
    pub phase_groups: Vec<SchedulePhaseGroup>,
    pub wbs_rows: Vec<ScheduleWbsRow>,
    pub totals: ScheduleTotals,
}

fn to_graphql(out: ProjectionOutput) -> ProjectScheduleProjection {
    ProjectScheduleProjection {
        project_id: out.project_id.into(),
        source: ScheduleProjectionSource::CurrentTaskFields,
        phase_groups: out
            .phase_groups
            .into_iter()
            .map(|g| SchedulePhaseGroup {
                phase_id: g.phase_id.map(ID::from),
                phase_key: g.phase_key,
                is_unphased: g.is_unphased,
                task_ids: g.task_ids.into_iter().map(ID::from).collect(),
                totals: g.totals.into(),
            })
            .collect(),
        wbs_rows: out
            .wbs_rows
            .into_iter()
            .map(|row| match row {
                projection::ScheduleWbsRow::Task(e) => ScheduleWbsRow::Task(ScheduleTaskEntry {
                    task_id: e.task_id.into(),
                    title: e.title,
                    phase_id: e.phase_id.map(ID::from),
                    start_date: e.start_date,
                    end_date: e.end_date,
                    effort_hours: e.effort_hours,
                    progress: e.progress,
                    depth: e.depth as i32,
                }),
                projection::ScheduleWbsRow::Heading(h) => {
                    ScheduleWbsRow::Heading(ScheduleSourceHeading {
                        heading_id: h.heading_id.into(),
                        source_system: h.source_system,
                        external_id: h.external_id,
                        title: h.title,
                        depth: h.depth as i32,
                    })
                }
            })
            .collect(),
        totals: out.totals.into(),
    }
}

/* ------------------------------ query root ------------------------------ */

#[derive(Default)]
pub struct ScheduleProjectionQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ScheduleProjectionQuery {
    /// Replaceable project schedule projection. Increment 1 producer is
    /// CURRENT_TASK_FIELDS (task dates/effort/progress); no capacity
    /// scheduler is involved.
    async fn project_schedule_projection(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<ProjectScheduleProjection> {
        let context = ctx.data::<GraphQLContext>()?;
        let user_id = project_authz::require_user(context)?;
        let pool = &context.db;
        let project_uuid = Uuid::parse_str(&project_id.to_string())
            .map_err(|e| async_graphql::Error::new(format!("invalid project_id: {e}")))?;
        // Reads are project-member-gated (owner OR any member), matching the
        // project query resolver's access model.
        project_authz::require_project_read(pool, user_id, project_uuid).await?;

        let task_rows = sqlx::query(
            "SELECT task_id, parent_task_id, title, phase_id, start_date, due_date, effort, \
             progress, wbs_group_id FROM tasks \
             WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)",
        )
        .bind(project_uuid)
        .fetch_all(pool)
        .await
        .map_err(|e| async_graphql::Error::new(format!("failed to load tasks: {e}")))?;
        let mut tasks: Vec<TaskFieldRow> = Vec::with_capacity(task_rows.len());
        for row in task_rows {
            use sqlx::Row;
            tasks.push(TaskFieldRow {
                task_id: row.try_get("task_id").map_err(db_field("task_id"))?,
                parent_task_id: row.try_get("parent_task_id").map_err(db_field("parent_task_id"))?,
                title: row.try_get("title").map_err(db_field("title"))?,
                phase_id: row.try_get("phase_id").map_err(db_field("phase_id"))?,
                start_date: row.try_get("start_date").map_err(db_field("start_date"))?,
                due_date: row.try_get("due_date").map_err(db_field("due_date"))?,
                effort: row.try_get::<Option<f64>, _>("effort").ok().flatten(),
                progress: row.try_get::<Option<i32>, _>("progress").ok().flatten(),
                wbs_group_id: row.try_get("wbs_group_id").map_err(db_field("wbs_group_id"))?,
            });
        }

        let phase_rows = sqlx::query(
            "SELECT phase_id, phase_key, display_order FROM project_phases \
             WHERE project_id = $1 AND is_active ORDER BY display_order, phase_key",
        )
        .bind(project_uuid)
        .fetch_all(pool)
        .await
        .map_err(|e| async_graphql::Error::new(format!("failed to load phases: {e}")))?;
        let mut phases: Vec<PhaseOrderRow> = Vec::with_capacity(phase_rows.len());
        for row in phase_rows {
            use sqlx::Row;
            phases.push(PhaseOrderRow {
                phase_id: row.try_get("phase_id").map_err(db_field("phase_id"))?,
                phase_key: row.try_get("phase_key").map_err(db_field("phase_key"))?,
                display_order: row.try_get("display_order").map_err(db_field("display_order"))?,
            });
        }

        let heading_rows = sqlx::query(
            "SELECT group_id, parent_group_id, source_system, external_id, title, position \
             FROM wbs_groups WHERE project_id = $1 \
             ORDER BY source_system, position, external_id",
        )
        .bind(project_uuid)
        .fetch_all(pool)
        .await
        .map_err(|e| async_graphql::Error::new(format!("failed to load wbs groups: {e}")))?;
        let mut headings: Vec<HeadingRow> = Vec::with_capacity(heading_rows.len());
        for row in heading_rows {
            use sqlx::Row;
            headings.push(HeadingRow {
                group_id: row.try_get("group_id").map_err(db_field("group_id"))?,
                parent_group_id: row
                    .try_get("parent_group_id")
                    .map_err(db_field("parent_group_id"))?,
                source_system: row.try_get("source_system").map_err(db_field("source_system"))?,
                external_id: row.try_get("external_id").map_err(db_field("external_id"))?,
                title: row.try_get("title").map_err(db_field("title"))?,
                position: row.try_get("position").map_err(db_field("position"))?,
            });
        }

        Ok(to_graphql(projection::build_projection(
            project_uuid, &tasks, &phases, &headings,
        )))
    }
}

fn db_field(field: &'static str) -> impl Fn(sqlx::Error) -> async_graphql::Error {
    move |e| async_graphql::Error::new(format!("failed to read column {field}: {e}"))
}

/* --------------------------- import dry-run types --------------------------- */

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct DryRunPhaseCount {
    pub phase_key: String,
    pub count: i32,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct DryRunIssue1139Check {
    pub external_id: String,
    /// Decimal truth as a String.
    pub effort_hours: String,
    pub assignee_display_name: String,
    pub assignee_linked: bool,
    pub wbs_row: i32,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ImportDryRunReport {
    pub source_system: String,
    pub root_external_id: String,
    pub root_title: String,
    pub heading_count: i32,
    pub task_count: i32,
    pub phase_counts: Vec<DryRunPhaseCount>,
    pub total_effort_hours: String,
    pub issue_1139: DryRunIssue1139Check,
    pub planned_assignee_count: i32,
    pub planned_dependency_count: i32,
    pub diagnostics: Vec<String>,
    /// SHA-256 hex of the canonical manifest snapshot
    /// (`imports::manifest::canonical_snapshot`).
    #[graphql(name = "snapshot_sha256")]
    pub snapshot_sha256: String,
    /// Full deterministic report payload (serializable DryRunReport).
    pub report_json: Option<serde_json::Value>,
}

impl ImportDryRunReport {
    fn build(report: DryRunReport, snapshot: String) -> Self {
        let report_json = serde_json::to_value(&report).ok();
        Self {
            source_system: report.source_system,
            root_external_id: report.root_external_id,
            root_title: report.root_title,
            heading_count: report.heading_count as i32,
            task_count: report.task_count as i32,
            phase_counts: report
                .phase_counts
                .into_iter()
                .map(|pc| DryRunPhaseCount {
                    phase_key: pc.phase_key,
                    count: pc.count as i32,
                })
                .collect(),
            total_effort_hours: report.total_effort_hours.to_string(),
            issue_1139: DryRunIssue1139Check {
                external_id: report.issue_1139.external_id,
                effort_hours: report.issue_1139.effort_hours.to_string(),
                assignee_display_name: report.issue_1139.assignee_display_name,
                assignee_linked: report.issue_1139.assignee_linked,
                wbs_row: report.issue_1139.wbs_row as i32,
            },
            planned_assignee_count: report.planned_assignees.len() as i32,
            planned_dependency_count: report.planned_dependencies.len() as i32,
            diagnostics: report.diagnostics,
            snapshot_sha256: snapshot,
            report_json,
        }
    }
}

#[derive(Default)]
pub struct ImportDryRunQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl ImportDryRunQuery {
    /// Issue-1115 import dry run over a static bundle manifest (v1 schema).
    /// PURE: deterministic, zero writes. Exposes the DryRunReport gates.
    async fn import_dry_run(
        &self,
        _ctx: &Context<'_>,
        manifest: serde_json::Value,
    ) -> Result<ImportDryRunReport> {
        let manifest: ImportManifest = serde_json::from_value(manifest)
            .map_err(|e| async_graphql::Error::new(format!("invalid manifest: {e}")))?;
        let snapshot = manifest::canonical_snapshot(&manifest);
        let report = issue_1115::dry_run(&manifest)
            .map_err(|e| async_graphql::Error::new(format!("dry-run validation failed: {e}")))?;
        Ok(ImportDryRunReport::build(report, snapshot))
    }
}
