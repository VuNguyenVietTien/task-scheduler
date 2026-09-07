//! Forward-only migration strategy (platform final rework, F1/F2).
//!
//! ## Why a custom strategy
//! The repo's migration history is not dependency-ordered by version:
//! `20230705000001` (plans → FK `projects`/`users`) and `20240616000001`
//! (reports → FK `projects`/`plans`/`tasks`/`users`) predate the
//! `20250319000000` baseline that creates those tables, because the schema was
//! historically imported manually before migrations were introduced. A fresh
//! empty database therefore cannot execute the chain in version order, while
//! already-deployed databases have those versions recorded in
//! `_sqlx_migrations` and must never see a checksum or version change.
//!
//! ## Rules (invariant)
//! 1. Migration files under `backend/migrations/` are immutable history:
//!    never edit, rename, or delete (sqlx enforces checksums —
//!    `VersionMismatch`). New migrations are new files with later versions.
//! 2. Databases with existing successful history migrate with the stock
//!    embedded `MIGRATOR` in **version order** (forward-only, pending only).
//! 3. Empty databases are bootstrapped with the SAME files/checksums in
//!    **dependency order** (`BOOTSTRAP_ORDER`); recorded history stays
//!    byte-compatible with stock `sqlx::migrate!`.
//! 4. `--baseline` is an explicit, validated, atomic operation for databases
//!    whose schema pre-exists without history: it REFUSES empty databases and
//!    schemas matching no embedded fingerprint, validates a cumulative
//!    versioned schema fingerprint, and marks ONLY the migration set the
//!    schema actually represents (the dependency prefix up to the matched
//!    version; later versions stay pending and apply normally on the next
//!    run). It runs under the same advisory lock id as sqlx and writes the
//!    whole synthetic history in ONE transaction.

use std::borrow::Cow;

use sqlx::{
    migrate::{MigrateError, Migrator},
    PgConnection, PgPool,
};

/// Embedded chain (compile-time). See module docs for the immutability rule.
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Dependency-correct execution order for fresh (empty) databases.
///
/// Forward-compatible: embedded versions not listed here (migrations added
/// later) are appended in version order.
const BOOTSTRAP_ORDER: &[i64] = &[
    20_250_319_000_000, // initial schema: users/projects/tasks/comments/…
    20_230_705_000_001, // plans (FK projects/users)
    20_240_616_000_001, // reports tables (FK projects/plans/tasks/users)
    20_250_408_000_000, // notifications.sender_id
    20_250_501_000_000, // users.fcm_tokens
    20_260_325_000_000, // report system refactor
    20_260_328_000_001, // uppercase task enums
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MigrationOutcome {
    /// Empty database bootstrapped: full chain applied in dependency order.
    BootstrappedFresh { applied: usize },
    /// Existing history: only pending migrations applied in version order.
    ForwardOnly { applied: usize },
    /// Explicit baseline: history recorded WITHOUT executing anything, but
    /// only for the migration set the validated schema actually represents.
    BaselineMarked {
        marked: usize,
        represented_version: i64,
    },
}

/// Migration currency of a database, used by readiness probing (F2).
///
/// Strong currency contract: `Current` requires the applied history to be
/// EXACTLY the embedded chain — complete version set in ascending prefix
/// order, byte-identical checksums, nothing ahead/unknown — plus the
/// latest-version schema tables present (partial-schema guard).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MigrationState {
    /// `_sqlx_migrations` table missing entirely.
    NoHistoryTable,
    /// Table exists but records no successful migration.
    NoHistory,
    /// A failed migration row (`success = false`) is present.
    Dirty,
    /// Applied history is not an ascending prefix of the embedded chain
    /// (hole / out-of-order synthetic history).
    MissingInterior { version: i64 },
    /// An applied row's checksum differs from the embedded migration.
    ChecksumMismatch { version: i64 },
    /// History contains a version the binary does not know (downgraded or
    /// foreign binary ran against this database).
    Ahead { version: i64, latest: i64 },
    /// Legitimately behind: applied prefix is short, pending migrations exist.
    Stale { applied: i64, expected: i64 },
    /// History claims the full chain but required schema tables are missing
    /// (e.g. tampered synthetic history).
    PartialSchema,
    /// Applied latest equals the embedded latest, checksums and schema OK.
    Current { version: i64 },
}

impl MigrationState {
    /// Stable machine-readable label for health payloads.
    pub fn label(&self) -> &'static str {
        match self {
            MigrationState::NoHistoryTable | MigrationState::NoHistory => "missing",
            MigrationState::Dirty => "dirty",
            MigrationState::MissingInterior { .. } => "missing-interior",
            MigrationState::ChecksumMismatch { .. } => "checksum-mismatch",
            MigrationState::Ahead { .. } => "ahead",
            MigrationState::Stale { .. } => "stale",
            MigrationState::PartialSchema => "partial-schema",
            MigrationState::Current { .. } => "current",
        }
    }
}

/* ------------------------- versioned schema fingerprints ------------------------ */

/// Cumulative schema contract per embedded version, derived from the migration
/// files themselves. `baseline` validates against these to decide which
/// migration set an existing schema actually represents; `probe_state` uses
/// the latest entry's tables as the partial-schema guard.
///
/// Entries are ordered by DEPENDENCY (bootstrap) order and each entry's
/// required objects are cumulative — matching entry `i` proves the schema
/// contains the effects of every migration in entries `0..=i`.
struct SchemaFingerprint {
    version: i64,
    /// Tables that must exist in `public` at this version.
    tables: &'static [&'static str],
    /// (table, column) pairs that must exist at this version.
    columns: &'static [(&'static str, &'static str)],
    /// (enum type, label) pairs that must exist at this version.
    enum_values: &'static [(&'static str, &'static str)],
}

/// Tables created by the 20250319 initial schema.
const FP_V1_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "comment_mentions",
    "comments",
    "notifications",
    "project_members",
    "projects",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
];

/// v1 tables + `plans` (20230705).
const FP_V2_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "comment_mentions",
    "comments",
    "notifications",
    "plans",
    "project_members",
    "projects",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
];

/// v2 tables + reports/bugs/report_tasks/task_status_history (20240616).
/// Table set is stable through 20260328 (later migrations only alter).
const FP_V3_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "notifications",
    "plans",
    "project_members",
    "projects",
    "report_tasks",
    "reports",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
];

/// v3 tables + taxonomy tables (20260901): project phases/categories with
/// translations. Table set is cumulative through the chain head.
const FP_V4_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "report_tasks",
    "reports",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
];

/// v4 tables + import provenance (20260901000200): external_import_runs,
/// wbs_groups, and additive tasks source-identity columns.
const FP_V5_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "report_tasks",
    "reports",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
    "wbs_groups",
];

/// v5 tables + resource membership (20260901000300): resource_members and
/// classification edges. Table set is cumulative through the chain head.
const FP_V6_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "report_tasks",
    "reports",
    "resource_member_classifications",
    "resource_members",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
    "wbs_groups",
];

/// v6 tables + scheduling config (20260905000001): groups, capacities,
/// overrides, days off, recurring commitments. Cumulative through head.
const FP_V7_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "member_capacity_overrides",
    "member_capacity_settings",
    "member_days_off",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "recurring_commitments",
    "report_tasks",
    "reports",
    "resource_group_members",
    "resource_groups",
    "resource_member_classifications",
    "resource_members",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "users",
    "wbs_groups",
];

/// v7 tables + timesheet entries (20260905000002).
const FP_V8_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "member_capacity_overrides",
    "member_capacity_settings",
    "member_days_off",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "recurring_commitments",
    "report_tasks",
    "reports",
    "resource_group_members",
    "resource_groups",
    "resource_member_classifications",
    "resource_members",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "timesheet_entries",
    "users",
    "wbs_groups",
];

/// v8 after member consolidation. `resource_members` is now a view, so it
/// must not be accepted as a second base table.
const FP_V9_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "member_capacity_overrides",
    "member_capacity_settings",
    "member_days_off",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "projects",
    "recurring_commitments",
    "report_tasks",
    "reports",
    "resource_group_members",
    "resource_groups",
    "resource_member_classifications",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "timesheet_entries",
    "users",
    "wbs_groups",
];
/// v9 plus project-local normal task catalogs. The old phase/category tables
/// stay in the WBS domain; these tables are a separate current-task contract.
const FP_V10_TABLES: &[&str] = &[
    "activity_logs",
    "attachments",
    "bugs",
    "comment_mentions",
    "comments",
    "external_import_runs",
    "member_capacity_overrides",
    "member_capacity_settings",
    "member_days_off",
    "notifications",
    "plans",
    "project_categories",
    "project_category_translations",
    "project_members",
    "project_phase_translations",
    "project_phases",
    "project_task_catalog_items",
    "project_task_catalog_labels",
    "projects",
    "recurring_commitments",
    "report_tasks",
    "reports",
    "resource_group_members",
    "resource_groups",
    "resource_member_classifications",
    "snapshots",
    "tags",
    "task_durations",
    "task_snapshots",
    "task_status_history",
    "task_statuses",
    "task_tags",
    "tasks",
    "timesheet_entries",
    "users",
    "wbs_groups",
];
const MEMBER_CONSOLIDATION_VERSION: i64 = 20_260_907_000_001;
const PROJECT_TASK_CATALOG_VERSION: i64 = 20_260_907_000_002;

/// Cumulative per version; order matches `BOOTSTRAP_ORDER` (dependency order).
const VERSIONED_FINGERPRINTS: &[SchemaFingerprint] = &[
    SchemaFingerprint {
        version: 20_250_319_000_000,
        tables: FP_V1_TABLES,
        columns: &[],
        enum_values: &[],
    },
    SchemaFingerprint {
        version: 20_230_705_000_001,
        tables: FP_V2_TABLES,
        columns: &[],
        enum_values: &[],
    },
    SchemaFingerprint {
        version: 20_240_616_000_001,
        tables: FP_V3_TABLES,
        columns: &[],
        enum_values: &[],
    },
    SchemaFingerprint {
        version: 20_250_408_000_000,
        tables: FP_V3_TABLES,
        columns: &[("notifications", "sender_id")],
        enum_values: &[],
    },
    SchemaFingerprint {
        version: 20_250_501_000_000,
        tables: FP_V3_TABLES,
        columns: &[("notifications", "sender_id"), ("users", "fcm_tokens")],
        enum_values: &[],
    },
    SchemaFingerprint {
        version: 20_260_325_000_000,
        tables: FP_V3_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_328_000_001,
        tables: FP_V3_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_901_000_100,
        tables: FP_V4_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_901_000_200,
        tables: FP_V5_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_901_000_300,
        tables: FP_V6_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_905_000_001,
        tables: FP_V7_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_905_000_002,
        tables: FP_V8_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_906_000_001,
        tables: FP_V8_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
            ("tasks", "assignee_resource_member_id"),
            ("plans", "revision"),
            ("plans", "config_fingerprint"),
            ("plans", "parent_plan_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: 20_260_906_000_002,
        tables: FP_V8_TABLES,
        columns: &[
            ("notifications", "sender_id"),
            ("users", "fcm_tokens"),
            ("reports", "rejected_tasks"),
            ("reports", "on_schedule_percentage"),
            ("reports", "delay_percentage"),
            ("tasks", "phase_id"),
            ("tasks", "category_id"),
            ("tasks", "source_system"),
            ("tasks", "external_id"),
            ("tasks", "source_metadata"),
            ("tasks", "wbs_group_id"),
            ("tasks", "assignee_resource_member_id"),
            ("plans", "revision"),
            ("plans", "config_fingerprint"),
            ("plans", "parent_plan_id"),
            ("member_days_off", "updated_at"),
            ("resource_groups", "updated_at"),
            ("recurring_commitments", "updated_at"),
            ("resource_group_members", "updated_at"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: MEMBER_CONSOLIDATION_VERSION,
        tables: FP_V9_TABLES,
        columns: &[
            ("project_members", "resource_member_id"),
            ("project_members", "display_name"),
            ("project_members", "member_kind"),
            ("tasks", "assignee_resource_member_id"),
            ("plans", "revision"),
            ("plans", "config_fingerprint"),
            ("plans", "parent_plan_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
    SchemaFingerprint {
        version: PROJECT_TASK_CATALOG_VERSION,
        tables: FP_V10_TABLES,
        columns: &[
            ("project_members", "resource_member_id"),
            ("project_members", "display_name"),
            ("project_members", "member_kind"),
            ("tasks", "assignee_resource_member_id"),
            ("tasks", "progress_catalog_item_id"),
            ("tasks", "category_catalog_item_id"),
            ("tasks", "task_type_catalog_item_id"),
            ("plans", "revision"),
            ("plans", "config_fingerprint"),
            ("plans", "parent_plan_id"),
        ],
        enum_values: &[
            ("member_role", "manager"),
            ("member_role", "leader"),
            ("member_role", "guest"),
            ("task_status", "TODO"),
        ],
    },
];

/// Migration set a matched fingerprint certifies: the dependency prefix
/// `0..=index`.
fn represented_version_set(index: usize) -> Vec<i64> {
    VERSIONED_FINGERPRINTS[..=index]
        .iter()
        .map(|f| f.version)
        .collect()
}

/// Whether the dependency prefix `0..=index` can be recorded in
/// `_sqlx_migrations` as a valid ascending prefix of the version-ordered
/// embedded chain (stock `Migrator::run` semantics). Because version order ≠
/// dependency order at the head of this chain (20230705/20240616 predate the
/// 20250319 baseline they depend on), only prefixes of size ≥ 3 are
/// expressible: a schema representing ONLY 20250319 (or 20250319+20230705)
/// cannot be soundly baselined — any synthetic prefix would either over-mark
/// unexecuted versions or break the next stock run. `baseline` refuses those.
fn prefix_expressible(index: usize) -> bool {
    let mut embedded: Vec<i64> = MIGRATOR.migrations.iter().map(|m| m.version).collect();
    embedded.sort_unstable();
    let mut set = represented_version_set(index);
    set.sort_unstable();
    embedded[..=index] == set[..]
}

/// Highest embedded version whose cumulative fingerprint is fully present,
/// returned as the index into [`VERSIONED_FINGERPRINTS`], or `None` when the
/// schema matches no embedded version (including the empty database case —
/// no `users` table fails even the first fingerprint).
async fn canonical_member_relations(conn: &mut PgConnection) -> Result<bool, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace \
         WHERE n.nspname = 'public' AND (c.relname = 'project_members' AND c.relkind = 'r' \
           OR c.relname = 'resource_members' AND c.relkind = 'v')",
    )
    .fetch_one(&mut *conn)
    .await?;
    if count != 2 {
        return Ok(false);
    }
    let column_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' \
         AND table_name = 'project_members' AND ((column_name IN ('resource_member_id', 'display_name') AND is_nullable = 'NO') \
         OR (column_name IN ('user_id', 'role') AND is_nullable = 'YES'))",
    )
    .fetch_one(&mut *conn)
    .await?;
    if column_count != 4 {
        return Ok(false);
    }
    let constraint_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_constraint WHERE conrelid = 'project_members'::regclass \
         AND conname = ANY($1)",
    )
    .bind(vec![
        "project_members_resource_member_id_key",
        "project_members_project_resource_key",
        "project_members_access_requires_linked_member",
    ])
    .fetch_one(&mut *conn)
    .await?;
    Ok(constraint_count == 3)
}

async fn represented_version(conn: &mut PgConnection) -> Result<Option<usize>, sqlx::Error> {
    'outer: for (index, fingerprint) in VERSIONED_FINGERPRINTS.iter().enumerate().rev() {
        let table_count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM information_schema.tables \
             WHERE table_schema = 'public' AND table_name = ANY($1)",
        )
        .bind(fingerprint.tables.to_vec())
        .fetch_one(&mut *conn)
        .await?;
        if table_count != fingerprint.tables.len() as i64 {
            continue;
        }
        for (table, column) in fingerprint.columns {
            let present: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns \
                 WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2)",
            )
            .bind(table)
            .bind(column)
            .fetch_one(&mut *conn)
            .await?;
            if !present {
                continue 'outer;
            }
        }
        for (type_name, label) in fingerprint.enum_values {
            let present: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM pg_enum e \
                 JOIN pg_type t ON t.oid = e.enumtypid \
                 WHERE t.typnamespace = 'public'::regnamespace \
                 AND t.typname = $1 AND e.enumlabel = $2)",
            )
            .bind(type_name)
            .bind(label)
            .fetch_one(&mut *conn)
            .await?;
            if !present {
                continue 'outer;
            }
        }
        if fingerprint.version >= MEMBER_CONSOLIDATION_VERSION
            && !canonical_member_relations(conn).await?
        {
            continue;
        }
        return Ok(Some(index));
    }
    Ok(None)
}

/* ----------------------------- sqlx lock discipline ---------------------------- */

// Mirrors sqlx-postgres `generate_lock_id` so baseline excludes exactly the
// same critical section as `Migrator::run`.
// 0x3d32ad9e chosen by fair dice roll (sqlx) * CRC-32/ISO-HDLC(db_name).
fn crc32_iso(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

fn sqlx_lock_id(database_name: &str) -> i64 {
    0x3d32_ad9e_i64.wrapping_mul(crc32_iso(database_name.as_bytes()) as i64)
}

/* --------------------------------- core logic ---------------------------------- */

pub fn latest_embedded_version() -> i64 {
    MIGRATOR.migrations.last().map(|m| m.version).unwrap_or(0)
}

fn strategy_error(message: impl Into<String>) -> MigrateError {
    MigrateError::Source(message.into().into())
}

/// Migrator over the same embedded migrations reordered for a fresh database.
fn bootstrap_migrator() -> Result<Migrator, MigrateError> {
    let mut ordered = Vec::with_capacity(MIGRATOR.migrations.len());
    let mut seen: Vec<i64> = Vec::with_capacity(MIGRATOR.migrations.len());
    for version in BOOTSTRAP_ORDER {
        let migration = MIGRATOR
            .migrations
            .iter()
            .find(|m| m.version == *version)
            .ok_or_else(|| {
                strategy_error(format!(
                    "BOOTSTRAP_ORDER references version {0} which is not in backend/migrations — \
                     update the order list",
                    version
                ))
            })?;
        ordered.push(migration.clone());
        seen.push(*version);
    }
    ordered.extend(
        MIGRATOR
            .migrations
            .iter()
            .filter(|m| !seen.contains(&m.version))
            .cloned(),
    );
    debug_assert_eq!(ordered.len(), MIGRATOR.migrations.len());
    Ok(Migrator {
        migrations: Cow::Owned(ordered),
        ignore_missing: false,
        locking: true,
    })
}

/// Applied rows ascending: `(version, success, checksum)`.
async fn applied_rows(
    conn: &mut PgConnection,
) -> Result<Option<Vec<(i64, bool, Vec<u8>)>>, sqlx::Error> {
    let has_table: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables \
         WHERE table_schema = 'public' AND table_name = '_sqlx_migrations')",
    )
    .fetch_one(&mut *conn)
    .await?;
    if !has_table {
        return Ok(None);
    }
    let rows: Vec<(i64, bool, Vec<u8>)> =
        sqlx::query_as("SELECT version, success, checksum FROM _sqlx_migrations ORDER BY version")
            .fetch_all(&mut *conn)
            .await?;
    Ok(Some(rows))
}

async fn successful_count(conn: &mut PgConnection) -> Result<usize, sqlx::Error> {
    match applied_rows(conn).await? {
        None => Ok(0),
        Some(rows) => Ok(rows.into_iter().filter(|(_, success, _)| *success).count()),
    }
}

/// Migration entry point used by `RUN_MIGRATIONS=true` boot and `bin/migrate`.
pub async fn run(pool: &PgPool) -> Result<MigrationOutcome, MigrateError> {
    // Scope the connection so it is returned to the pool BEFORE any
    // `Migrator::run` call (bin/migrate uses a single-connection pool).
    let (rows, successful) = {
        let mut conn = pool.acquire().await.map_err(MigrateError::Execute)?;
        let rows = applied_rows(&mut conn).await?;
        let successful = rows
            .as_ref()
            .map(|r| r.iter().filter(|(_, s, _)| *s).count())
            .unwrap_or(0);
        (rows, successful)
    };

    if successful > 0 {
        if rows.as_deref().unwrap_or(&[]).iter().any(|(_, s, _)| !*s) {
            return Err(strategy_error(
                "_sqlx_migrations contains a failed migration row — resolve the dirty state \
                 manually before running migrations",
            ));
        }
        // Forward-only on existing history: stock version order, checksums
        // enforced by sqlx.
        MIGRATOR.run(pool).await?;
        let applied = {
            let mut conn = pool.acquire().await.map_err(MigrateError::Execute)?;
            successful_count(&mut conn)
                .await
                .map_err(MigrateError::Execute)?
        } - successful;
        return Ok(MigrationOutcome::ForwardOnly { applied });
    }

    if rows.filter(|rows| !rows.is_empty()).is_some() {
        return Err(strategy_error(
            "_sqlx_migrations has rows but no successful migration — refusing to migrate a \
             dirty database",
        ));
    }

    let represented = {
        let mut conn = pool.acquire().await.map_err(MigrateError::Execute)?;
        represented_version(&mut conn)
            .await
            .map_err(MigrateError::Execute)?
    };
    match represented {
        None => {
            bootstrap_migrator()?.run(pool).await?;
            Ok(MigrationOutcome::BootstrappedFresh {
                applied: MIGRATOR.migrations.len(),
            })
        }
        Some(index) => {
            let version = VERSIONED_FINGERPRINTS[index].version;
            Err(strategy_error(format!(
                "schema already exists (represents embedded version {}) without migration history — \
                 refusing to re-run the chain. `cargo run --bin migrate -- --baseline` will validate \
                 the schema and mark ONLY the versions it represents; newer versions then apply \
                 normally on the next run",
                version
            )))
        }
    }
}

/// Baseline: record history WITHOUT executing, but ONLY the migration set the
/// schema demonstrably represents (fingerprint-validated dependency prefix).
///
/// Guarantees (final rework, closing F1):
/// - Refuses empty databases and schemas matching no embedded fingerprint
///   (a lone `users` table is NOT parity).
/// - Runs under the sqlx advisory lock (same lock id as `Migrator::run`) and
///   writes the entire synthetic history in ONE transaction — a concurrent
///   migration can never observe partial history.
/// - Later versions stay pending and are applied by the next normal run.
pub async fn baseline(pool: &PgPool) -> Result<MigrationOutcome, MigrateError> {
    let mut tx = pool.begin().await.map_err(MigrateError::Execute)?;

    let database_name: String = sqlx::query_scalar("SELECT current_database()")
        .fetch_one(&mut *tx)
        .await
        .map_err(MigrateError::Execute)?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(sqlx_lock_id(&database_name))
        .execute(&mut *tx)
        .await
        .map_err(MigrateError::Execute)?;

    // Re-validate under the lock: no history, no dirty rows.
    if let Some(rows) = applied_rows(&mut tx).await.map_err(MigrateError::Execute)? {
        if rows.iter().any(|(_, success, _)| *success) {
            return Err(strategy_error(
                "baseline refused: migration history already exists",
            ));
        }
        if !rows.is_empty() {
            return Err(strategy_error(
                "baseline refused: _sqlx_migrations contains a failed migration row",
            ));
        }
    }

    // Empty databases match NO fingerprint (the initial schema requires 15
    // tables); partial imports (e.g. only `users`) fail the same way.
    let index = represented_version(&mut tx)
        .await
        .map_err(MigrateError::Execute)?
        .ok_or_else(|| {
            strategy_error(
                "baseline refused: the schema does not match ANY embedded version — an empty \
                 database must use the normal bootstrap, and a partial import must be completed \
                 (or dropped) first",
            )
        })?;
    let represented = VERSIONED_FINGERPRINTS[index].version;
    if !prefix_expressible(index) {
        return Err(strategy_error(format!(
            "baseline refused: the validated schema represents embedded version {} but its \
             dependency set cannot be recorded as an applied prefix of the version-ordered \
             chain (version order != dependency order at the chain head). Import the legacy \
             schema to at least the 20240616 (reports) level or drop it and run the normal \
             bootstrap",
            represented
        )));
    }
    let version_set = represented_version_set(index);

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _sqlx_migrations ( \
             version BIGINT PRIMARY KEY, \
             description TEXT NOT NULL, \
             installed_on TIMESTAMPTZ NOT NULL DEFAULT now(), \
             success BOOLEAN NOT NULL, \
             checksum BYTEA NOT NULL, \
             execution_time BIGINT NOT NULL \
         )",
    )
    .execute(&mut *tx)
    .await
    .map_err(MigrateError::Execute)?;

    let mut marked = 0usize;
    for migration in MIGRATOR.migrations.iter() {
        if !version_set.contains(&migration.version) {
            continue;
        }
        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, success, checksum, \
             execution_time) VALUES ($1, $2, TRUE, $3, -1) ON CONFLICT (version) DO NOTHING",
        )
        .bind(migration.version)
        .bind(&*migration.description)
        .bind(&*migration.checksum)
        .execute(&mut *tx)
        .await
        .map_err(MigrateError::Execute)?;
        marked += 1;
    }
    if marked == 0 {
        return Err(strategy_error(
            "baseline refused: no embedded version is represented by this schema",
        ));
    }

    tx.commit().await.map_err(MigrateError::Execute)?;
    Ok(MigrationOutcome::BaselineMarked {
        marked,
        represented_version: represented,
    })
}

/// Readiness probing (F2): strong migration currency of a reachable database.
///
/// `Current` requires: applied history is exactly the embedded chain — same
/// length (no ahead/unknown versions), ascending prefix (no interior holes),
/// byte-identical checksums — AND the latest fingerprint's tables exist
/// (tampered synthetic history claiming full parity fails here).
pub async fn probe_state(pool: &PgPool) -> Result<MigrationState, sqlx::Error> {
    let rows = {
        let mut conn = pool.acquire().await?;
        match applied_rows(&mut conn).await? {
            None => return Ok(MigrationState::NoHistoryTable),
            Some(rows) => rows,
        }
    };
    if rows.is_empty() {
        return Ok(MigrationState::NoHistory);
    }
    if rows.iter().any(|(_, success, _)| !*success) {
        return Ok(MigrationState::Dirty);
    }

    // Embedded chain, ascending (sqlx resolves migrations sorted by version).
    let embedded: Vec<&sqlx::migrate::Migration> = MIGRATOR.migrations.iter().collect();
    let latest = latest_embedded_version();

    // Foreign/ahead versions: anything the binary does not know about.
    for (version, _, _) in rows.iter() {
        if !embedded.iter().any(|m| m.version == *version) {
            return Ok(MigrationState::Ahead {
                version: *version,
                latest,
            });
        }
    }

    // Applied history must be the ascending prefix of the embedded chain with
    // byte-identical checksums.
    if rows.len() > embedded.len() {
        return Ok(MigrationState::Ahead {
            version: rows.last().map(|(v, _, _)| *v).unwrap_or(latest),
            latest,
        });
    }
    for (index, (version, _, checksum)) in rows.iter().enumerate() {
        let migration = embedded[index];
        if *version != migration.version {
            return Ok(MigrationState::MissingInterior {
                version: migration.version,
            });
        }
        if checksum.as_slice() != migration.checksum.as_ref() {
            return Ok(MigrationState::ChecksumMismatch {
                version: migration.version,
            });
        }
    }

    if rows.len() < embedded.len() {
        return Ok(MigrationState::Stale {
            applied: rows.last().map(|(v, _, _)| *v).unwrap_or(0),
            expected: latest,
        });
    }

    // Full history claimed — enforce the schema contract (latest tables).
    let latest_tables = VERSIONED_FINGERPRINTS
        .last()
        .map(|f| f.tables)
        .unwrap_or(&[]);
    let table_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM information_schema.tables \
         WHERE table_schema = 'public' AND table_name = ANY($1)",
    )
    .bind(latest_tables.to_vec())
    .fetch_one(pool)
    .await?;
    if table_count != latest_tables.len() as i64 {
        return Ok(MigrationState::PartialSchema);
    }
    if latest >= MEMBER_CONSOLIDATION_VERSION {
        let mut conn = pool.acquire().await?;
        if !canonical_member_relations(&mut *conn).await? {
            return Ok(MigrationState::PartialSchema);
        }
    }

    Ok(MigrationState::Current { version: latest })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_order_covers_exactly_the_embedded_chain() {
        let boot = bootstrap_migrator().unwrap();
        assert_eq!(boot.migrations.len(), MIGRATOR.migrations.len());
        let bootstrapped_order: Vec<i64> = boot.migrations.iter().map(|m| m.version).collect();
        assert_eq!(bootstrapped_order.first(), Some(&20_250_319_000_000));
        let mut embedded: Vec<i64> = MIGRATOR.migrations.iter().map(|m| m.version).collect();
        let mut bootstrapped_sorted = bootstrapped_order.clone();
        embedded.sort_unstable();
        bootstrapped_sorted.sort_unstable();
        assert_eq!(embedded, bootstrapped_sorted);
    }

    #[test]
    fn fingerprints_cover_every_embedded_version() {
        for migration in MIGRATOR.migrations.iter() {
            assert!(
                VERSIONED_FINGERPRINTS
                    .iter()
                    .any(|f| f.version == migration.version),
                "missing fingerprint for {}",
                migration.version
            );
        }
        assert_eq!(
            VERSIONED_FINGERPRINTS.last().map(|f| f.version),
            Some(latest_embedded_version()),
            "latest fingerprint must track the embedded chain head"
        );
    }

    #[test]
    fn dependency_prefixes_are_prefix_expressible_only_from_reports_on() {
        // Version order != dependency order at the chain head: a v1-only or
        // v2-only legacy schema is NOT baseline-expressible and must be
        // refused; every schema including the reports tables (v3+, what real
        // legacy databases look like) is.
        for index in 0..VERSIONED_FINGERPRINTS.len() {
            assert_eq!(
                prefix_expressible(index),
                index >= 2,
                "fingerprint entry {index} expressibility"
            );
        }
    }

    #[test]
    fn fingerprints_are_strictly_discriminating() {
        // v2 requires the plans table that v1 does not create yet.
        assert!(!FP_V1_TABLES.contains(&"plans"));
        assert!(FP_V2_TABLES.contains(&"plans"));
        assert!(FP_V1_TABLES.iter().all(|t| FP_V2_TABLES.contains(t)));
        assert!(FP_V2_TABLES.iter().all(|t| FP_V3_TABLES.contains(t)));
        // The reports tables only appear from v3 on.
        for t in ["reports", "bugs", "report_tasks", "task_status_history"] {
            assert!(!FP_V1_TABLES.contains(&t) && !FP_V2_TABLES.contains(&t));
            assert!(FP_V3_TABLES.contains(&t));
        }
    }

    #[test]
    fn state_labels_are_stable() {
        assert_eq!(MigrationState::NoHistoryTable.label(), "missing");
        assert_eq!(
            MigrationState::MissingInterior { version: 1 }.label(),
            "missing-interior"
        );
        assert_eq!(
            MigrationState::ChecksumMismatch { version: 1 }.label(),
            "checksum-mismatch"
        );
        assert_eq!(
            MigrationState::Ahead {
                version: 9,
                latest: 7
            }
            .label(),
            "ahead"
        );
        assert_eq!(MigrationState::PartialSchema.label(), "partial-schema");
        assert_eq!(
            MigrationState::Stale {
                applied: 1,
                expected: 2
            }
            .label(),
            "stale"
        );
        assert_eq!(MigrationState::Current { version: 2 }.label(), "current");
    }

    #[test]
    fn crc32_matches_reference_vector() {
        // CRC-32/ISO-HDLC reference: "123456789" → 0xCBF43926 (zlib crc32).
        assert_eq!(crc32_iso(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32_iso(b""), 0x0000_0000);
    }

    #[test]
    fn sqlx_lock_id_is_stable_per_database() {
        assert_eq!(sqlx_lock_id("khampha_db"), sqlx_lock_id("khampha_db"));
        assert_ne!(sqlx_lock_id("a"), sqlx_lock_id("b"));
    }
}
