//! Timesheet / logwork resolvers — herdr-260905 requirement 8.
//!
//! No logwork entity existed before (verified repo-wide), so
//! `timesheet_entries` (migration 20260905000002) is the canonical store.
//!
//! Authorization:
//! - every role can read/write its own entries; managers/leaders may read
//!   others, while only managers may edit others;
//! - `save_timesheet_batch` resolves an optional target user under that matrix,
//!   and each row's task must belong to
//!   the same project;
//! - duplicate prevention: UNIQUE (user_id, task_id, work_date) + upsert
//!   (ON CONFLICT DO UPDATE) so re-saving a day overwrites instead of
//!   duplicating.

use async_graphql::{Context, InputObject, Object, Result, SimpleObject, ID};
use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string())
        .map_err(|e| async_graphql::Error::new(format!("invalid {field}: {e}")))
}

fn db_err(e: sqlx::Error) -> async_graphql::Error {
    AuthError::Database(e).into()
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct TimesheetRow {
    entry_id: Uuid,
    project_id: Uuid,
    user_id: Uuid,
    task_id: Uuid,
    work_date: NaiveDate,
    hours: f64,
    note: Option<String>,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TimesheetEntry {
    pub id: ID,
    pub project_id: ID,
    pub user_id: ID,
    pub task_id: ID,
    pub work_date: NaiveDate,
    pub hours: f64,
    pub note: Option<String>,
}

impl From<TimesheetRow> for TimesheetEntry {
    fn from(r: TimesheetRow) -> Self {
        Self {
            id: r.entry_id.into(),
            project_id: r.project_id.into(),
            user_id: r.user_id.into(),
            task_id: r.task_id.into(),
            work_date: r.work_date,
            hours: r.hours,
            note: r.note,
        }
    }
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TimesheetEntryInput {
    pub task_id: ID,
    pub work_date: NaiveDate,
    pub hours: f64,
    pub note: Option<String>,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TimesheetBatchError {
    /// Zero-based row index within the submitted batch.
    pub row: i32,
    pub message: String,
}

#[derive(SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct TimesheetBatchResult {
    pub saved: i32,
    pub errors: Vec<TimesheetBatchError>,
}

#[derive(Default)]
pub struct TimesheetQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TimesheetQuery {
    /// The CURRENT user's timesheet entries for a project within a date
    /// range. Authorization: caller must be owner/member of the project;
    /// rows are always scoped to the caller's own user_id.
    async fn my_timesheet_entries(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        from: NaiveDate,
        to: NaiveDate,
        user_id: Option<ID>,
    ) -> Result<Vec<TimesheetEntry>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let caller = project_authz::require_user(context)?;
        let user_id = user_id
            .as_ref()
            .map(|id| parse_id(id, "user_id"))
            .transpose()?
            .unwrap_or(caller);
        project_authz::require_timesheet_access(&context.db, caller, project_id, user_id, false)
            .await?;
        if to < from {
            return Err(async_graphql::Error::new("to must be >= from"));
        }
        let rows: Vec<TimesheetRow> = sqlx::query_as(
            "SELECT entry_id, project_id, user_id, task_id, work_date, hours, note \
             FROM timesheet_entries \
             WHERE project_id = $1 AND user_id = $2 AND work_date BETWEEN $3 AND $4 \
             ORDER BY work_date, task_id",
        )
        .bind(project_id)
        .bind(user_id)
        .bind(from)
        .bind(to)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        Ok(rows.into_iter().map(TimesheetEntry::from).collect())
    }
}

#[derive(Default)]
pub struct TimesheetMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl TimesheetMutation {
    /// Batch-save the caller's timesheet entries. Upsert semantics on
    /// (user_id, task_id, work_date): re-saving a day overwrites the stored
    /// hours — duplicates are impossible. Per-row failures are returned (not
    /// thrown) so one bad row never loses the valid ones.
    async fn save_timesheet_batch(
        &self,
        ctx: &Context<'_>,
        input: SaveTimesheetBatchInput,
    ) -> Result<TimesheetBatchResult> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        let target = input
            .user_id
            .as_ref()
            .map(|id| parse_id(id, "user_id"))
            .transpose()?
            .unwrap_or(caller);
        project_authz::require_timesheet_access(&context.db, caller, project_id, target, true)
            .await?;

        let mut saved = 0i32;
        let mut errors: Vec<TimesheetBatchError> = Vec::new();
        let mut tx = context.db.begin().await.map_err(db_err)?;

        for (idx, entry) in input.entries.iter().enumerate() {
            let row_err = |msg: String| TimesheetBatchError {
                row: idx as i32,
                message: msg,
            };
            if entry.hours < 0.0 || entry.hours > 24.0 || entry.hours.is_nan() {
                errors.push(row_err(format!(
                    "invalid hours {} (must be in [0, 24]; 0 clears the entry)",
                    entry.hours
                )));
                continue;
            }
            let task_id = match parse_id(&entry.task_id, "task_id") {
                Ok(id) => id,
                Err(e) => {
                    errors.push(row_err(e.message));
                    continue;
                }
            };
            // Task must belong to this project (authorization of the task).
            let task_project: Option<Uuid> = sqlx::query_scalar(
                "SELECT project_id FROM tasks WHERE task_id = $1 AND is_deleted = false",
            )
            .bind(task_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(db_err)?;
            match task_project {
                Some(p) if p == project_id => {}
                _ => {
                    errors.push(row_err(format!(
                        "task {:?} is not in this project",
                        entry.task_id
                    )));
                    continue;
                }
            }
            // hours == 0 is the correction semantic: clear a mistaken prior
            // log for (caller, task, date). Idempotent — deleting an absent
            // row is a no-op that still counts as processed.
            if entry.hours == 0.0 {
                let res = sqlx::query(
                    "DELETE FROM timesheet_entries \
                     WHERE user_id = $1 AND task_id = $2 AND work_date = $3",
                )
                .bind(target)
                .bind(task_id)
                .bind(entry.work_date)
                .execute(&mut *tx)
                .await
                .map_err(db_err)?;
                if res.rows_affected() > 0 {
                    saved += res.rows_affected() as i32;
                }
                continue;
            }
            let res = sqlx::query(
                "INSERT INTO timesheet_entries (project_id, user_id, task_id, work_date, hours, note) \
                 VALUES ($1, $2, $3, $4, $5, $6) \
                 ON CONFLICT (user_id, task_id, work_date) DO UPDATE \
                 SET hours = EXCLUDED.hours, note = EXCLUDED.note, updated_at = now()",
            )
            .bind(project_id)
            .bind(target)
            .bind(task_id)
            .bind(entry.work_date)
            .bind(entry.hours)
            .bind(entry.note.clone())
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
            saved += res.rows_affected() as i32;
        }

        tx.commit().await.map_err(db_err)?;
        Ok(TimesheetBatchResult { saved, errors })
    }
}

#[derive(InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct SaveTimesheetBatchInput {
    pub project_id: ID,
    pub user_id: Option<ID>,
    pub entries: Vec<TimesheetEntryInput>,
}

// Silence unused-import warning for DateTime (kept for future row metadata).
#[allow(dead_code)]
type _Ts = DateTime<Utc>;
