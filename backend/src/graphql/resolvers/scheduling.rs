//! Scheduling configuration resolvers — herdr-260905 requirements 3/4/6.
//!
//! - R3 capacity: per-resource-member weekday/weekend hours, per-date
//!   overrides (incl. working weekends), and days off at
//!   individual/group/project scope. Authorization: project write gate for
//!   mutations, read gate for queries (same `project_authz` module as the
//!   Increment 1 resolvers).
//! - R4 groups: real groups of project members (`resource_groups` +
//!   `resource_group_members`), bulk member management, and
//!   `add_project_members_by_group` which expands a group into
//!   `project_members` rows for every linked user in one transaction
//!   (idempotent via UNIQUE(project_id, user_id)).
//! - R6 recurring commitments: daily/weekly/monthly rules with fixed start
//!   hour + duration. Expansion into occurrences is bounded and happens in
//!   the scheduling client; the API only stores/validates rules.

use async_graphql::{Context, Object, Result, ID};
use chrono::NaiveDate;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::resolvers::project_authz;
use crate::graphql::types::MemberRole;

fn parse_id(id: &ID, field: &str) -> Result<Uuid> {
    Uuid::parse_str(&id.to_string())
        .map_err(|e| async_graphql::Error::new(format!("invalid {field}: {e}")))
}

fn db_err(e: sqlx::Error) -> async_graphql::Error {
    AuthError::Database(e).into()
}

fn parse_date(s: &str, field: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|e| async_graphql::Error::new(format!("invalid {field} {s:?}: {e}")))
}

/* --------------------------------- rows ---------------------------------- */

#[derive(Debug, Clone, sqlx::FromRow)]
struct MemberCapacityRow {
    resource_member_id: Uuid,
    weekday_hours: f64,
    weekend_hours: f64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct CapacityOverrideRow {
    resource_member_id: Uuid,
    override_date: NaiveDate,
    hours: f64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct DayOffRow {
    day_off_id: Uuid,
    project_id: Uuid,
    scope: String,
    resource_member_id: Option<Uuid>,
    group_id: Option<Uuid>,
    start_date: NaiveDate,
    end_date: NaiveDate,
    reason: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct GroupRow {
    group_id: Uuid,
    project_id: Uuid,
    name: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct CommitmentRow {
    commitment_id: Uuid,
    project_id: Uuid,
    title: String,
    scope: String,
    group_id: Option<Uuid>,
    frequency: String,
    recurrence_interval: i32,
    weekday: Option<i32>,
    month_day: Option<i32>,
    start_date: NaiveDate,
    end_date: Option<NaiveDate>,
    start_hour: i32,
    duration_hours: f64,
}

/* --------------------------------- types --------------------------------- */

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CapacityDateOverride {
    pub date: NaiveDate,
    pub hours: f64,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct MemberCapacity {
    pub resource_member_id: ID,
    pub weekday_hours: f64,
    pub weekend_hours: f64,
    pub date_overrides: Vec<CapacityDateOverride>,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct DayOff {
    pub id: ID,
    pub project_id: ID,
    pub scope: String,
    pub resource_member_id: Option<ID>,
    pub group_id: Option<ID>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct ResourceGroup {
    pub id: ID,
    pub project_id: ID,
    pub name: String,
    pub member_ids: Vec<ID>,
}

#[derive(async_graphql::Enum, Copy, Clone, Eq, PartialEq)]
pub enum RecurrenceFrequency {
    Daily,
    Weekly,
    Monthly,
}

impl RecurrenceFrequency {
    fn as_str(self) -> &'static str {
        match self {
            RecurrenceFrequency::Daily => "DAILY",
            RecurrenceFrequency::Weekly => "WEEKLY",
            RecurrenceFrequency::Monthly => "MONTHLY",
        }
    }
}

#[derive(async_graphql::SimpleObject)]
#[graphql(rename_fields = "snake_case")]
pub struct RecurringCommitment {
    pub id: ID,
    pub project_id: ID,
    pub title: String,
    /// PROJECT | GROUP
    pub scope: String,
    pub group_id: Option<ID>,
    /// DAILY | WEEKLY | MONTHLY
    pub frequency: String,
    pub recurrence_interval: i32,
    /// 0=Sun … 6=Sat (WEEKLY)
    pub weekday: Option<i32>,
    /// 1..=31 (MONTHLY)
    pub month_day: Option<i32>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    /// Fixed hour of day 0..=23
    pub start_hour: i32,
    pub duration_hours: f64,
}

impl From<CommitmentRow> for RecurringCommitment {
    fn from(r: CommitmentRow) -> Self {
        Self {
            id: r.commitment_id.into(),
            project_id: r.project_id.into(),
            title: r.title,
            scope: r.scope,
            group_id: r.group_id.map(ID::from),
            frequency: r.frequency,
            recurrence_interval: r.recurrence_interval,
            weekday: r.weekday,
            month_day: r.month_day,
            start_date: r.start_date,
            end_date: r.end_date,
            start_hour: r.start_hour,
            duration_hours: r.duration_hours,
        }
    }
}

/* -------------------------------- queries -------------------------------- */

#[derive(Default)]
pub struct SchedulingQuery;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl SchedulingQuery {
    /// Per-member capacity settings (R3). Members without a row use the
    /// documented defaults (weekday 8h / weekend 0h).
    async fn capacity_settings(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<MemberCapacity>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let settings: Vec<MemberCapacityRow> = sqlx::query_as(
            "SELECT mc.resource_member_id, mc.weekday_hours, mc.weekend_hours \
             FROM member_capacity_settings mc \
             JOIN resource_members rm ON rm.resource_member_id = mc.resource_member_id \
             WHERE rm.project_id = $1",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        let overrides: Vec<CapacityOverrideRow> = sqlx::query_as(
            "SELECT o.resource_member_id, o.override_date, o.hours \
             FROM member_capacity_overrides o \
             JOIN resource_members rm ON rm.resource_member_id = o.resource_member_id \
             WHERE rm.project_id = $1 ORDER BY o.override_date",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        let mut result: Vec<MemberCapacity> = settings
            .into_iter()
            .map(|s| MemberCapacity {
                resource_member_id: s.resource_member_id.into(),
                weekday_hours: s.weekday_hours,
                weekend_hours: s.weekend_hours,
                date_overrides: Vec::new(),
            })
            .collect();
        for o in overrides {
            if let Some(cap) = result
                .iter_mut()
                .find(|c| c.resource_member_id.to_string() == o.resource_member_id.to_string())
            {
                cap.date_overrides.push(CapacityDateOverride {
                    date: o.override_date,
                    hours: o.hours,
                });
            }
        }
        Ok(result)
    }

    /// Days off (leave/holidays) for a project at all scopes (R3).
    async fn day_offs(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<DayOff>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let rows: Vec<DayOffRow> = sqlx::query_as(
            "SELECT day_off_id, project_id, scope, resource_member_id, group_id, \
             start_date, end_date, reason FROM member_days_off \
             WHERE project_id = $1 ORDER BY start_date",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        Ok(rows
            .into_iter()
            .map(|r| DayOff {
                id: r.day_off_id.into(),
                project_id: r.project_id.into(),
                scope: r.scope,
                resource_member_id: r.resource_member_id.map(ID::from),
                group_id: r.group_id.map(ID::from),
                start_date: r.start_date,
                end_date: r.end_date,
                reason: r.reason,
            })
            .collect())
    }

    /// Member groups with their member ids (R4).
    async fn resource_groups(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<ResourceGroup>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let rows: Vec<GroupRow> = sqlx::query_as(
            "SELECT group_id, project_id, name FROM resource_groups \
             WHERE project_id = $1 ORDER BY name",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        let mut result = Vec::with_capacity(rows.len());
        for g in rows {
            let member_ids: Vec<Uuid> = sqlx::query_scalar(
                "SELECT resource_member_id FROM resource_group_members \
                 WHERE group_id = $1 ORDER BY added_at",
            )
            .bind(g.group_id)
            .fetch_all(&context.db)
            .await
            .map_err(db_err)?;
            result.push(ResourceGroup {
                id: g.group_id.into(),
                project_id: g.project_id.into(),
                name: g.name,
                member_ids: member_ids.into_iter().map(ID::from).collect(),
            });
        }
        Ok(result)
    }

    /// Recurring commitments (R6).
    async fn recurring_commitments(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Vec<RecurringCommitment>> {
        let context = ctx.data::<GraphQLContext>()?;
        let project_id = parse_id(&project_id, "project_id")?;
        let user_id = project_authz::require_user(context)?;
        project_authz::require_project_read(&context.db, user_id, project_id).await?;
        let rows: Vec<CommitmentRow> = sqlx::query_as(
            "SELECT commitment_id, project_id, title, scope, group_id, frequency, \
             recurrence_interval, weekday, month_day, start_date, end_date, \
             start_hour, duration_hours FROM recurring_commitments \
             WHERE project_id = $1 ORDER BY start_date, title",
        )
        .bind(project_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        Ok(rows.into_iter().map(RecurringCommitment::from).collect())
    }
}

/* ------------------------------- mutations -------------------------------- */

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct SetMemberCapacityInput {
    pub resource_member_id: ID,
    pub weekday_hours: f64,
    pub weekend_hours: f64,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CapacityDateOverrideInput {
    pub resource_member_id: ID,
    pub date: NaiveDate,
    pub hours: f64,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct AddDayOffInput {
    pub project_id: ID,
    /// INDIVIDUAL | GROUP | PROJECT
    pub scope: String,
    pub resource_member_id: Option<ID>,
    pub group_id: Option<ID>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
}

#[derive(async_graphql::InputObject)]
#[graphql(rename_fields = "snake_case")]
pub struct CreateRecurringCommitmentInput {
    pub project_id: ID,
    pub title: String,
    /// PROJECT | GROUP
    pub scope: String,
    pub group_id: Option<ID>,
    pub frequency: RecurrenceFrequency,
    pub recurrence_interval: Option<i32>,
    pub weekday: Option<i32>,
    pub month_day: Option<i32>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub start_hour: i32,
    pub duration_hours: f64,
}

#[derive(Default)]
pub struct SchedulingMutation;

#[Object(rename_fields = "snake_case", rename_args = "snake_case")]
impl SchedulingMutation {
    /// R3: set a member's default weekday/weekend hours (persisted).
    async fn set_member_capacity(
        &self,
        ctx: &Context<'_>,
        input: SetMemberCapacityInput,
    ) -> Result<MemberCapacity> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let member_id = parse_id(&input.resource_member_id, "resource_member_id")?;
        if !(0.0..=24.0).contains(&input.weekday_hours)
            || !(0.0..=24.0).contains(&input.weekend_hours)
        {
            return Err(async_graphql::Error::new("hours must be within 0..=24"));
        }
        let project_id: Uuid = sqlx::query_scalar(
            "SELECT project_id FROM resource_members WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .fetch_optional(&context.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        let row: MemberCapacityRow = sqlx::query_as(
            "INSERT INTO member_capacity_settings (resource_member_id, weekday_hours, weekend_hours) \
             VALUES ($1, $2, $3) \
             ON CONFLICT (resource_member_id) DO UPDATE \
             SET weekday_hours = EXCLUDED.weekday_hours, weekend_hours = EXCLUDED.weekend_hours \
             RETURNING resource_member_id, weekday_hours, weekend_hours",
        )
        .bind(member_id)
        .bind(input.weekday_hours)
        .bind(input.weekend_hours)
        .fetch_one(&context.db)
        .await
        .map_err(db_err)?;
        Ok(MemberCapacity {
            resource_member_id: row.resource_member_id.into(),
            weekday_hours: row.weekday_hours,
            weekend_hours: row.weekend_hours,
            date_overrides: Vec::new(),
        })
    }

    /// R3: set an explicit per-date hours override (e.g. working Saturday 8h
    /// or a 0h weekday). Upsert per (member, date).
    async fn set_capacity_date_override(
        &self,
        ctx: &Context<'_>,
        input: CapacityDateOverrideInput,
    ) -> Result<MemberCapacity> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let member_id = parse_id(&input.resource_member_id, "resource_member_id")?;
        if !(0.0..=24.0).contains(&input.hours) {
            return Err(async_graphql::Error::new("hours must be within 0..=24"));
        }
        let project_id: Uuid = sqlx::query_scalar(
            "SELECT project_id FROM resource_members WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .fetch_optional(&context.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| async_graphql::Error::new("unknown resource member"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        sqlx::query(
            "INSERT INTO member_capacity_overrides (resource_member_id, override_date, hours) \
             VALUES ($1, $2, $3) \
             ON CONFLICT (resource_member_id, override_date) DO UPDATE SET hours = EXCLUDED.hours",
        )
        .bind(member_id)
        .bind(input.date)
        .bind(input.hours)
        .execute(&context.db)
        .await
        .map_err(db_err)?;
        let overrides: Vec<CapacityOverrideRow> = sqlx::query_as(
            "SELECT resource_member_id, override_date, hours FROM member_capacity_overrides \
             WHERE resource_member_id = $1 ORDER BY override_date",
        )
        .bind(member_id)
        .fetch_all(&context.db)
        .await
        .map_err(db_err)?;
        let defaults: Option<MemberCapacityRow> = sqlx::query_as(
            "SELECT resource_member_id, weekday_hours, weekend_hours \
             FROM member_capacity_settings WHERE resource_member_id = $1",
        )
        .bind(member_id)
        .fetch_optional(&context.db)
        .await
        .map_err(db_err)?;
        Ok(MemberCapacity {
            resource_member_id: member_id.into(),
            weekday_hours: defaults.as_ref().map(|d| d.weekday_hours).unwrap_or(8.0),
            weekend_hours: defaults.as_ref().map(|d| d.weekend_hours).unwrap_or(0.0),
            date_overrides: overrides
                .into_iter()
                .map(|o| CapacityDateOverride {
                    date: o.override_date,
                    hours: o.hours,
                })
                .collect(),
        })
    }

    /// R3: add a day off (individual / group / project scope).
    async fn add_day_off(&self, ctx: &Context<'_>, input: AddDayOffInput) -> Result<DayOff> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        let scope = match input.scope.as_str() {
            "INDIVIDUAL" | "GROUP" | "PROJECT" => input.scope.clone(),
            other => {
                return Err(async_graphql::Error::new(format!(
                    "invalid scope {other:?}: INDIVIDUAL | GROUP | PROJECT"
                )))
            }
        };
        let member_id = match &input.resource_member_id {
            Some(id) => Some(parse_id(id, "resource_member_id")?),
            None => None,
        };
        let group_id = match &input.group_id {
            Some(id) => Some(parse_id(id, "group_id")?),
            None => None,
        };
        if input.end_date < input.start_date {
            return Err(async_graphql::Error::new("end_date must be >= start_date"));
        }
        let row: DayOffRow = sqlx::query_as(
            "INSERT INTO member_days_off \
             (project_id, scope, resource_member_id, group_id, start_date, end_date, reason) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             RETURNING day_off_id, project_id, scope, resource_member_id, group_id, \
             start_date, end_date, reason",
        )
        .bind(project_id)
        .bind(&scope)
        .bind(member_id)
        .bind(group_id)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.reason)
        .fetch_one(&context.db)
        .await
        .map_err(db_err)?;
        Ok(DayOff {
            id: row.day_off_id.into(),
            project_id: row.project_id.into(),
            scope: row.scope,
            resource_member_id: row.resource_member_id.map(ID::from),
            group_id: row.group_id.map(ID::from),
            start_date: row.start_date,
            end_date: row.end_date,
            reason: row.reason,
        })
    }

    /// R3: remove a day off.
    async fn remove_day_off(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let day_off_id = parse_id(&id, "id")?;
        let project_id: Uuid =
            sqlx::query_scalar("SELECT project_id FROM member_days_off WHERE day_off_id = $1")
                .bind(day_off_id)
                .fetch_optional(&context.db)
                .await
                .map_err(db_err)?
                .ok_or_else(|| async_graphql::Error::new("unknown day off"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        sqlx::query("DELETE FROM member_days_off WHERE day_off_id = $1")
            .bind(day_off_id)
            .execute(&context.db)
            .await
            .map_err(db_err)?;
        Ok(true)
    }

    /* ------------------------------ groups (R4) ----------------------------- */

    async fn create_resource_group(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        name: String,
    ) -> Result<ResourceGroup> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let project_id = parse_id(&project_id, "project_id")?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(async_graphql::Error::new("group name must not be empty"));
        }
        let row: GroupRow = sqlx::query_as(
            "INSERT INTO resource_groups (project_id, name) VALUES ($1, $2) \
             RETURNING group_id, project_id, name",
        )
        .bind(project_id)
        .bind(&name)
        .fetch_one(&context.db)
        .await
        .map_err(db_err)?;
        Ok(ResourceGroup {
            id: row.group_id.into(),
            project_id: row.project_id.into(),
            name: row.name,
            member_ids: Vec::new(),
        })
    }

    async fn delete_resource_group(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let group_id = parse_id(&id, "id")?;
        let project_id: Uuid =
            sqlx::query_scalar("SELECT project_id FROM resource_groups WHERE group_id = $1")
                .bind(group_id)
                .fetch_optional(&context.db)
                .await
                .map_err(db_err)?
                .ok_or_else(|| async_graphql::Error::new("unknown group"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        sqlx::query("DELETE FROM resource_groups WHERE group_id = $1")
            .bind(group_id)
            .execute(&context.db)
            .await
            .map_err(db_err)?;
        Ok(true)
    }

    /// Add resource members to a group (idempotent). Returns the new size.
    async fn add_resource_group_members(
        &self,
        ctx: &Context<'_>,
        group_id: ID,
        member_ids: Vec<ID>,
    ) -> Result<i32> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let group_id = parse_id(&group_id, "group_id")?;
        let project_id: Uuid =
            sqlx::query_scalar("SELECT project_id FROM resource_groups WHERE group_id = $1")
                .bind(group_id)
                .fetch_optional(&context.db)
                .await
                .map_err(db_err)?
                .ok_or_else(|| async_graphql::Error::new("unknown group"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        let mut tx = context.db.begin().await.map_err(db_err)?;
        for mid in member_ids {
            let member = parse_id(&mid, "member_id")?;
            // Same-project guard before insert.
            let member_project: Option<Uuid> = sqlx::query_scalar(
                "SELECT project_id FROM resource_members WHERE resource_member_id = $1",
            )
            .bind(member)
            .fetch_optional(&mut *tx)
            .await
            .map_err(db_err)?;
            let member_project = member_project
                .ok_or_else(|| async_graphql::Error::new(format!("unknown member {mid:?}")))?;
            if member_project != project_id {
                return Err(async_graphql::Error::new(
                    "member belongs to a different project",
                ));
            }
            sqlx::query(
                "INSERT INTO resource_group_members (group_id, resource_member_id) \
                 VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(group_id)
            .bind(member)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
        }
        let size: i32 = sqlx::query_scalar(
            "SELECT count(*)::int FROM resource_group_members WHERE group_id = $1",
        )
        .bind(group_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;
        tx.commit().await.map_err(db_err)?;
        Ok(size)
    }

    async fn remove_resource_group_member(
        &self,
        ctx: &Context<'_>,
        group_id: ID,
        member_id: ID,
    ) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let group_id = parse_id(&group_id, "group_id")?;
        let member_id = parse_id(&member_id, "member_id")?;
        let project_id: Uuid =
            sqlx::query_scalar("SELECT project_id FROM resource_groups WHERE group_id = $1")
                .bind(group_id)
                .fetch_optional(&context.db)
                .await
                .map_err(db_err)?
                .ok_or_else(|| async_graphql::Error::new("unknown group"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        sqlx::query(
            "DELETE FROM resource_group_members \
             WHERE group_id = $1 AND resource_member_id = $2",
        )
        .bind(group_id)
        .bind(member_id)
        .execute(&context.db)
        .await
        .map_err(db_err)?;
        Ok(true)
    }

    /// R4: expand a group into `project_members` rows — every LINKED group
    /// member's user gets project membership (placeholders skipped). Atomic +
    /// idempotent; returns the number of users actually added.
    async fn add_project_members_by_group(
        &self,
        ctx: &Context<'_>,
        group_id: ID,
        role: Option<MemberRole>,
    ) -> Result<i32> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let group_id = parse_id(&group_id, "group_id")?;
        let project_id: Uuid =
            sqlx::query_scalar("SELECT project_id FROM resource_groups WHERE group_id = $1")
                .bind(group_id)
                .fetch_optional(&context.db)
                .await
                .map_err(db_err)?
                .ok_or_else(|| async_graphql::Error::new("unknown group"))?;
        let role = role.unwrap_or(MemberRole::Member);
        let mut tx = context.db.begin().await.map_err(db_err)?;
        project_authz::require_project_write_tx(&mut tx, caller, project_id).await?;
        project_authz::require_role_assignment_tx(&mut tx, caller, project_id, role.as_str())
            .await?;
        let users: Vec<Uuid> = sqlx::query_scalar(
            "SELECT rm.user_id FROM resource_group_members gm \
             JOIN project_members rm ON rm.resource_member_id = gm.resource_member_id \
             WHERE gm.group_id = $1 AND rm.user_id IS NOT NULL AND rm.role IS NULL ORDER BY rm.user_id",
        )
        .bind(group_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(db_err)?;
        let mut added = 0i32;
        for user_id in users {
            project_authz::require_access_target_tx(&mut tx, caller, project_id, user_id).await?;
            // Group members already have the canonical identity referenced by
            // the group. Grant access on that row; do not create a second row.
            let res = sqlx::query(
                "UPDATE project_members SET role = $3, invited_by = $4, updated_at = now() \
                 WHERE project_id = $1 AND user_id = $2 AND role IS NULL",
            )
            .bind(project_id)
            .bind(user_id)
            .bind(role)
            .bind(caller)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
            added += res.rows_affected() as i32;
        }
        tx.commit().await.map_err(db_err)?;
        Ok(added)
    }

    /* ------------------------ recurring commitments (R6) -------------------- */

    async fn create_recurring_commitment(
        &self,
        ctx: &Context<'_>,
        input: CreateRecurringCommitmentInput,
    ) -> Result<RecurringCommitment> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let project_id = parse_id(&input.project_id, "project_id")?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        if input.title.trim().is_empty() {
            return Err(async_graphql::Error::new("title must not be empty"));
        }
        if !(0..=23).contains(&input.start_hour) {
            return Err(async_graphql::Error::new("start_hour must be 0..=23"));
        }
        if !(0.0..=24.0).contains(&input.duration_hours) || input.duration_hours <= 0.0 {
            return Err(async_graphql::Error::new(
                "duration_hours must be in (0, 24]",
            ));
        }
        if let Some(end) = input.end_date {
            if end < input.start_date {
                return Err(async_graphql::Error::new("end_date must be >= start_date"));
            }
        }
        let scope = match input.scope.as_str() {
            "PROJECT" => "PROJECT".to_string(),
            "GROUP" => "GROUP".to_string(),
            other => {
                return Err(async_graphql::Error::new(format!(
                    "invalid scope {other:?}: PROJECT | GROUP"
                )))
            }
        };
        let group_id = match &input.group_id {
            Some(id) => {
                if scope != "GROUP" {
                    return Err(async_graphql::Error::new(
                        "group_id is only valid for GROUP scope",
                    ));
                }
                Some(parse_id(id, "group_id")?)
            }
            None => {
                if scope == "GROUP" {
                    return Err(async_graphql::Error::new("GROUP scope requires group_id"));
                }
                None
            }
        };
        if let Some(gid) = group_id {
            let gp: Option<Uuid> =
                sqlx::query_scalar("SELECT project_id FROM resource_groups WHERE group_id = $1")
                    .bind(gid)
                    .fetch_optional(&context.db)
                    .await
                    .map_err(db_err)?;
            match gp {
                Some(p) if p == project_id => {}
                _ => {
                    return Err(async_graphql::Error::new(
                        "group must belong to the same project",
                    ))
                }
            }
        }
        let row: CommitmentRow = sqlx::query_as(
            "INSERT INTO recurring_commitments \
             (project_id, title, scope, group_id, frequency, recurrence_interval, weekday, \
              month_day, start_date, end_date, start_hour, duration_hours) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
             RETURNING commitment_id, project_id, title, scope, group_id, frequency, \
             recurrence_interval, weekday, month_day, start_date, end_date, start_hour, duration_hours",
        )
        .bind(project_id)
        .bind(input.title.trim())
        .bind(&scope)
        .bind(group_id)
        .bind(input.frequency.as_str())
        .bind(input.recurrence_interval.unwrap_or(1).max(1))
        .bind(input.weekday)
        .bind(input.month_day)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.start_hour)
        .bind(input.duration_hours)
        .fetch_one(&context.db)
        .await
        .map_err(db_err)?;
        Ok(row.into())
    }

    async fn delete_recurring_commitment(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let caller = project_authz::require_user(context)?;
        let commitment_id = parse_id(&id, "id")?;
        let project_id: Uuid = sqlx::query_scalar(
            "SELECT project_id FROM recurring_commitments WHERE commitment_id = $1",
        )
        .bind(commitment_id)
        .fetch_optional(&context.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| async_graphql::Error::new("unknown commitment"))?;
        project_authz::require_project_write(&context.db, caller, project_id).await?;
        sqlx::query("DELETE FROM recurring_commitments WHERE commitment_id = $1")
            .bind(commitment_id)
            .execute(&context.db)
            .await
            .map_err(db_err)?;
        Ok(true)
    }
}
