//! Saved-plan lifecycle resolvers — herdr-260906.
//!
//! Semantics (safest simple revision model):
//! - `save_plan_snapshot` with NO `plan_id` creates revision 1 of a NEW plan.
//!   A client-computed draft (New Plan) is never persisted until this call —
//!   nothing overwrites an existing saved plan implicitly.
//! - `plan_id` + `NEW_REVISION` (default-safe append) inserts revision N+1 as
//!   a NEW row chained via `parent_plan_id`, activates the new row and
//!   deactivates the old one. The previous snapshot is never mutated.
//! - `plan_id` + `SAME_REVISION` overwrites ONLY that row's snapshot, and only
//!   when the user explicitly chooses it (used after Recalculate review).
//! - Staleness is COMPUTED AT READ TIME: the plan stores the deterministic
//!   project scheduling-config `config_fingerprint` captured at save time
//!   (categories: members / capacity / overrides / days_off / groups /
//!   group_members / commitments). Capacity/leave/group/meeting edits change
//!   the current fingerprint but never mutate the saved snapshot — loaded
//!   plans always render their stored bars until an explicit recalc+save.

use async_graphql::{Context, ID, InputObject, Object, Result, SimpleObject};
use chrono::{DateTime, Utc};
use serde_json::Value;
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

/// Map a unique-violation (23505) on the one-active-plan-per-project index
/// to an actionable message instead of a raw 500 (review P2-4 backstop —
/// the advisory lock already prevents the race in practice).
fn conflict_or_db(e: sqlx::Error) -> async_graphql::Error {
    let is_unique_violation = e
        .as_database_error()
        .and_then(|d| d.code())
        .map(|c| c == *"23505")
        .unwrap_or(false);
    if is_unique_violation {
        return async_graphql::Error::new(
            "another plan was activated concurrently for this project — please retry the save",
        );
    }
    db_err(e)
}

/* --------------------------------- types ---------------------------------- */

#[derive(SimpleObject, Debug, Clone)]
#[graphql(rename_fields = "snake_case")]
pub struct SavedPlan {
    pub plan_id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub revision: i32,
    pub is_active: bool,
    pub stale: bool,
    pub stale_reasons: Vec<String>,
    pub config_fingerprint: Option<String>,
    pub parent_plan_id: Option<Uuid>,
    pub plan_data: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(SimpleObject, Debug, Clone)]
#[graphql(rename_fields = "snake_case")]
pub struct PlanRecalcMetadata {
    pub plan_id: Uuid,
    pub project_id: Uuid,
    pub revision: i32,
    pub stale: bool,
    pub stale_reasons: Vec<String>,
    pub current_config_fingerprint: String,
    pub task_ids: Vec<String>,
}

#[derive(async_graphql::Enum, Copy, Clone, Debug, Eq, PartialEq)]
pub enum PlanRevisionMode {
    /// Append revision N+1 as a new row (non-destructive; default-safe).
    NewRevision,
    /// Overwrite THIS plan row's snapshot only (explicit user choice).
    SameRevision,
}

#[derive(InputObject, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct SavePlanSnapshotInput {
    pub project_id: ID,
    pub name: String,
    /// v2 snapshot: {version:2, tasks:[{task_id,start_date,end_date,
    /// hours_per_day,assignee ids,priority_order}], meta:{...}}.
    pub snapshot: Value,
    /// Existing plan id for SAME_REVISION / NEW_REVISION saves; omit to
    /// create a brand-new plan (revision 1).
    pub plan_id: Option<ID>,
    pub revision_mode: PlanRevisionMode,
}

/* ------------------------------ fingerprint ------------------------------- */

async fn fp_one(
    pool: &sqlx::PgPool,
    project_id: Uuid,
    sql: &str,
) -> std::result::Result<String, sqlx::Error> {
    sqlx::query_scalar::<_, String>(sql)
        .bind(project_id)
        .fetch_one(pool)
        .await
}

/// Deterministic, category-keyed fingerprint of the project scheduling
/// config. Category values are `count|max(updated_at)` per source so the
/// string changes whenever capacity/leave/group/meeting config changes.
/// Ordering is fixed → identical config always yields an identical string.
async fn config_fingerprint(
    pool: &sqlx::PgPool,
    project_id: Uuid,
) -> std::result::Result<String, sqlx::Error> {
    let members = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM resource_members WHERE project_id = $1",
    )
    .await?;
    let capacity = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM member_capacity_settings s JOIN resource_members m ON m.resource_member_id = s.resource_member_id WHERE m.project_id = $1",
    )
    .await?;
    let overrides = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM member_capacity_overrides o JOIN resource_members m ON m.resource_member_id = o.resource_member_id WHERE m.project_id = $1",
    )
    .await?;
    let days_off = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM member_days_off WHERE project_id = $1",
    )
    .await?;
    let groups = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM resource_groups WHERE project_id = $1",
    )
    .await?;
    let group_members = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(gm.updated_at)::text,'') FROM resource_group_members gm JOIN resource_groups g ON g.group_id = gm.group_id WHERE g.project_id = $1",
    )
    .await?;
    let commitments = fp_one(pool, project_id,
        "SELECT count(*) || '|' || coalesce(max(updated_at)::text,'') FROM recurring_commitments WHERE project_id = $1",
    )
    .await?;
    Ok(format!(
        "members={members};capacity={capacity};overrides={overrides};days_off={days_off};groups={groups};group_members={group_members};commitments={commitments}"
    ))
}

/// Categories whose fingerprint value differs between saved and current.
fn stale_reasons(saved: &str, current: &str) -> Vec<String> {
    let parse = |s: &str| {
        s.split(';')
            .filter_map(|kv| kv.split_once('='))
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect::<std::collections::BTreeMap<_, _>>()
    };
    let old = parse(saved);
    let now = parse(current);
    let mut reasons = Vec::new();
    for (cat, now_v) in &now {
        match old.get(cat) {
            Some(old_v) if old_v == now_v => {}
            Some(_) => reasons.push(format!(
                "config_changed:{cat} (saved plan predates current {cat} settings)"
            )),
            None => reasons.push(format!("config_added:{cat} since this plan was saved")),
        }
    }
    for cat in old.keys() {
        if !now.contains_key(cat) {
            reasons.push(format!("config_removed:{cat} since this plan was saved"));
        }
    }
    reasons
}

/* --------------------------------- rows ----------------------------------- */

#[derive(Debug, Clone, sqlx::FromRow)]
struct PlanRow {
    plan_id: Uuid,
    project_id: Uuid,
    name: String,
    revision: i32,
    is_active: bool,
    config_fingerprint: Option<String>,
    parent_plan_id: Option<Uuid>,
    plan_data: Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

fn hydrate_with(current: String, row: PlanRow) -> SavedPlan {
    let (stale, reasons) = match &row.config_fingerprint {
        Some(saved) if saved != &current => (true, stale_reasons(saved, &current)),
        _ => (false, Vec::new()),
    };
    SavedPlan {
        plan_id: row.plan_id,
        project_id: row.project_id,
        name: row.name,
        revision: row.revision,
        is_active: row.is_active,
        stale,
        stale_reasons: reasons,
        config_fingerprint: row.config_fingerprint,
        parent_plan_id: row.parent_plan_id,
        plan_data: row.plan_data,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

async fn hydrate(
    pool: &sqlx::PgPool,
    row: PlanRow,
) -> std::result::Result<SavedPlan, sqlx::Error> {
    let current = config_fingerprint(pool, row.project_id).await?;
    Ok(hydrate_with(current, row))
}

/// Upper bounds (review P2-3): name is checked at the call site;
/// snapshot payload ≤ 512 KB; ≤ 5000 tasks; hours/day finite, ≥ 0, ≤ 24;
/// date keys and start/end values must be yyyy-MM-dd; task ids must be UUIDs.
const SNAPSHOT_MAX_BYTES: usize = 512 * 1024;
const SNAPSHOT_MAX_TASKS: usize = 5_000;

fn valid_date_str(v: &str) -> bool {
    let b = v.as_bytes();
    b.len() == 10
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[4] == b'-'
        && b[5..7].iter().all(u8::is_ascii_digit)
        && b[7] == b'-'
        && b[8..10].iter().all(u8::is_ascii_digit)
}

fn validate_snapshot(snapshot: &Value) -> Result<()> {
    let obj = snapshot
        .as_object()
        .ok_or_else(|| async_graphql::Error::new("snapshot must be a JSON object"))?;
    let tasks = obj
        .get("tasks")
        .and_then(|t| t.as_array())
        .ok_or_else(|| async_graphql::Error::new("snapshot.tasks must be an array"))?;
    if tasks.is_empty() {
        return Err(async_graphql::Error::new(
            "snapshot.tasks must not be empty",
        ));
    }
    if tasks.len() > SNAPSHOT_MAX_TASKS {
        return Err(async_graphql::Error::new(format!(
            "snapshot.tasks too large: {} (max {SNAPSHOT_MAX_TASKS})",
            tasks.len()
        )));
    }
    if serde_json::to_string(snapshot).map(|s| s.len()).unwrap_or(usize::MAX) > SNAPSHOT_MAX_BYTES {
        return Err(async_graphql::Error::new(format!(
            "snapshot payload too large (max {SNAPSHOT_MAX_BYTES} bytes)"
        )));
    }
    // EXACT client v2 wire keys (web/src/utils/planLifecycle.ts).
    for (i, t) in tasks.iter().enumerate() {
        let id = t
            .get("taskId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                async_graphql::Error::new(format!("snapshot.tasks[{i}].taskId is required"))
            })?;
        if Uuid::parse_str(id).is_err() {
            return Err(async_graphql::Error::new(format!(
                "snapshot.tasks[{i}].taskId is not a valid UUID"
            )));
        }
        for field in ["startDate", "endDate"] {
            if let Some(d) = t.get(field).and_then(|v| v.as_str()) {
                if !valid_date_str(d) {
                    return Err(async_graphql::Error::new(format!(
                        "snapshot.tasks[{i}].{field} must be yyyy-MM-dd (got {d:?})"
                    )));
                }
            }
        }
        if let Some(hours) = t.get("hoursPerDay").and_then(|v| v.as_object()) {
            for (k, v) in hours {
                if !valid_date_str(k) {
                    return Err(async_graphql::Error::new(format!(
                        "snapshot.tasks[{i}].hoursPerDay key {k:?} must be yyyy-MM-dd"
                    )));
                }
                let h = v.as_f64().ok_or_else(|| {
                    async_graphql::Error::new(format!(
                        "snapshot.tasks[{i}].hoursPerDay[{k}] must be a number"
                    ))
                })?;
                if !h.is_finite() || h < 0.0 || h > 24.0 {
                    return Err(async_graphql::Error::new(format!(
                        "snapshot.tasks[{i}].hoursPerDay[{k}] must be within 0..=24 (got {h})"
                    )));
                }
            }
        }
    }
    Ok(())
}

/* --------------------------------- query ---------------------------------- */

#[derive(Default)]
pub struct PlanLifecycleQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl PlanLifecycleQuery {
    /// Load one saved plan (snapshot bars + computed staleness). Rendering a
    /// saved plan uses ONLY plan_data — current config affects nothing until
    /// an explicit recalculate + save.
    async fn saved_plan(&self, ctx: &Context<'_>, plan_id: ID) -> Result<Option<SavedPlan>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let user = project_authz::require_user(context)?;
        let plan_id = parse_id(&plan_id, "plan_id")?;

        let row = sqlx::query_as::<_, PlanRow>(
            "SELECT plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at FROM plans WHERE plan_id = $1",
        )
        .bind(plan_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?;
        let Some(row) = row else { return Ok(None) };
        project_authz::require_project_read(pool, user, row.project_id).await?;
        Ok(Some(hydrate(pool, row).await.map_err(db_err)?))
    }

    /// All saved plans of a project (newest first).
    async fn saved_plans(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<SavedPlan>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let user = project_authz::require_user(context)?;
        let project_id = parse_id(&project_id, "project_id")?;
        project_authz::require_project_read(pool, user, project_id).await?;

        let rows = sqlx::query_as::<_, PlanRow>(
            "SELECT plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at FROM plans WHERE project_id = $1 ORDER BY created_at DESC, revision DESC",
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(db_err)?;
        let current = config_fingerprint(pool, project_id).await.map_err(db_err)?;
        Ok(rows.into_iter().map(|row| hydrate_with(current.clone(), row)).collect())
    }

    /// Recalculate metadata: which tasks the saved plan schedules (so the
    /// client rebuilds a draft from the SAVED plan's tasks with CURRENT
    /// config) + current fingerprint + staleness.
    async fn plan_recalc_metadata(
        &self,
        ctx: &Context<'_>,
        plan_id: ID,
    ) -> Result<PlanRecalcMetadata> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let user = project_authz::require_user(context)?;
        let plan_id = parse_id(&plan_id, "plan_id")?;

        let row = sqlx::query_as::<_, PlanRow>(
            "SELECT plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at FROM plans WHERE plan_id = $1",
        )
        .bind(plan_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?;
        let row = row.ok_or_else(|| async_graphql::Error::new("plan not found"))?;
        project_authz::require_project_read(pool, user, row.project_id).await?;
        let current = config_fingerprint(pool, row.project_id).await.map_err(db_err)?;
        let (stale, reasons) = match &row.config_fingerprint {
            Some(saved) if saved != &current => (true, stale_reasons(saved, &current)),
            _ => (false, Vec::new()),
        };
        let task_ids = row
            .plan_data
            .get("tasks")
            .and_then(|t| t.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| t.get("taskId").and_then(|v| v.as_str()))
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        Ok(PlanRecalcMetadata {
            plan_id: row.plan_id,
            project_id: row.project_id,
            revision: row.revision,
            stale,
            stale_reasons: reasons,
            current_config_fingerprint: current,
            task_ids,
        })
    }
}

/* ------------------------------- mutation --------------------------------- */

#[derive(Default)]
pub struct PlanLifecycleMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl PlanLifecycleMutation {
    /// Save a client-computed draft as a snapshot. NEVER implicitly
    /// overwrites an existing plan: no plan_id → new plan (revision 1);
    /// plan_id + NEW_REVISION → appended revision row (old row retained);
    /// plan_id + SAME_REVISION → explicit in-place overwrite of that row.
    async fn save_plan_snapshot(
        &self,
        ctx: &Context<'_>,
        input: SavePlanSnapshotInput,
    ) -> Result<SavedPlan> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let user = project_authz::require_user(context)?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        validate_snapshot(&input.snapshot)?;

        project_authz::require_project_write(pool, user, project_id).await?;

        let fingerprint = config_fingerprint(pool, project_id)
            .await
            .map_err(db_err)?;
        let mut tx = pool.begin().await.map_err(db_err)?;

        // Serialize ALL plan saves per project (review P2-4): the advisory
        // xact lock closes the deactivate-actives/INSERT race that could
        // otherwise surface as a raw unique-violation 500.
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 260906))")
            .bind(project_id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;

        // Snapshot task ids must reference NON-DELETED tasks of THIS project
        // (review P3-2): garbage/cross-project ids are rejected, not stored.
        let out_of_scope: i64 = sqlx::query_scalar(
            r#"
            SELECT count(*) FROM jsonb_array_elements($1::jsonb -> 'tasks') e
            WHERE NOT EXISTS (
                SELECT 1 FROM tasks t
                WHERE t.task_id = (e.value ->> 'taskId')::uuid
                  AND t.project_id = $2
                  AND NOT COALESCE(t.is_deleted, false)
            )
            "#,
        )
        .bind(&input.snapshot)
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;
        if out_of_scope > 0 {
            return Err(async_graphql::Error::new(format!(
                "snapshot contains {out_of_scope} task id(s) that do not belong to this project"
            )));
        }

        if input.name.trim().is_empty() || input.name.chars().count() > 255 {
            return Err(async_graphql::Error::new(
                "plan name must be 1..=255 characters",
            ));
        }

        let row: PlanRow = match input.plan_id.as_ref() {
            None => {
                // Deactivate existing active plans (unique_active_plan_per_project)
                sqlx::query("UPDATE plans SET is_active = false, updated_at = now() WHERE project_id = $1 AND is_active")
                    .bind(project_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(db_err)?;
                sqlx::query_as::<_, PlanRow>(
                    r#"
                    INSERT INTO plans (project_id, name, created_by, plan_data, is_active, revision, config_fingerprint, parent_plan_id)
                    VALUES ($1, $2, $3, $4, true, 1, $5, NULL)
                    RETURNING plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at
                    "#,
                )
                .bind(project_id)
                .bind(&input.name)
                .bind(user)
                .bind(&input.snapshot)
                .bind(&fingerprint)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| conflict_or_db(e))?
            }
            Some(plan_id) => {
                let plan_id = parse_id(plan_id, "plan_id")?;
                let existing = sqlx::query_as::<_, PlanRow>(
                    "SELECT plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at FROM plans WHERE plan_id = $1 FOR UPDATE",
                )
                .bind(plan_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(db_err)?;
                let existing = existing
                    .ok_or_else(|| async_graphql::Error::new("plan not found"))?;
                if existing.project_id != project_id {
                    return Err(async_graphql::Error::new(
                        "plan does not belong to this project",
                    ));
                }
                match input.revision_mode {
                    PlanRevisionMode::SameRevision => {
                        sqlx::query_as::<_, PlanRow>(
                            r#"
                            UPDATE plans SET plan_data = $2, config_fingerprint = $3, updated_at = now()
                            WHERE plan_id = $1
                            RETURNING plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at
                            "#,
                        )
                        .bind(plan_id)
                        .bind(&input.snapshot)
                        .bind(&fingerprint)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(db_err)?
                    }
                    PlanRevisionMode::NewRevision => {
                        // Branching from ANY historical revision (review
                        // P2-2): deactivate EVERY active plan of the project
                        // (not just the target row — the target may be an
                        // inactive historical revision), then append
                        // revision = project max + 1 with parent = target.
                        sqlx::query(
                            "UPDATE plans SET is_active = false, updated_at = now() WHERE project_id = $1 AND is_active",
                        )
                        .bind(project_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(db_err)?;
                        let max_rev: i32 = sqlx::query_scalar(
                            "SELECT coalesce(max(revision), 0) FROM plans WHERE project_id = $1",
                        )
                        .bind(project_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(db_err)?;
                        sqlx::query_as::<_, PlanRow>(
                            r#"
                            INSERT INTO plans (project_id, name, created_by, plan_data, is_active, revision, config_fingerprint, parent_plan_id)
                            VALUES ($1, $2, $3, $4, true, $5, $6, $7)
                            RETURNING plan_id, project_id, name, revision, is_active, config_fingerprint, parent_plan_id, plan_data, created_at, updated_at
                            "#,
                        )
                        .bind(project_id)
                        .bind(&input.name)
                        .bind(user)
                        .bind(&input.snapshot)
                        .bind(max_rev + 1)
                        .bind(&fingerprint)
                        .bind(plan_id)
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(|e| conflict_or_db(e))?
                    }
                }
            }
        };

        tx.commit().await.map_err(db_err)?;
        // Fingerprint was captured inside this call — plan is fresh by
        // construction, but hydrate anyway for a single source of truth.
        hydrate(pool, row).await.map_err(db_err)
    }
}
