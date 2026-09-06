//! Project taxonomy (phases/categories) and real-task hierarchy rules.
//!
//! Design doc §4/§6 (project scheduling & WBS):
//! - A phase/category is a project-scoped task attribute ONLY. It is never a
//!   task, task parent, schedulable object, dependency endpoint, capacity
//!   consumer, or meeting.
//! - Exactly five default phases exist per project (immutable keys, order,
//!   ja/en/vi labels). Labels are never identifiers.
//! - Locale fallback: requested → project default → first available → key.
//! - Archiving a referenced term requires atomic reassignment or explicit
//!   Unphased (NULL) conversion.
//! - The real task hierarchy stays arbitrary-depth and independent of phases.
//!   Trees materialize from ID/reference indexes, never by recursively
//!   mutating detached clones (the old assembler lost depth that way).
//! - Re-parenting rejects self / cycle / cross-project and preserves
//!   phase/category.

use std::collections::HashMap;

use sqlx::PgPool;
use uuid::Uuid;

/* --------------------------------- seeds --------------------------------- */

/// One accepted default phase (immutable key, order, and labels).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DefaultTerm {
    pub key: &'static str,
    pub display_order: i32,
    pub ja: &'static str,
    pub en: &'static str,
    pub vi: &'static str,
}

/// The exact five default phases every project receives, in order
/// (design doc §4.1). Do not reorder, rename, or extend without a spec change.
pub const DEFAULT_PHASES: [DefaultTerm; 5] = [
    DefaultTerm {
        key: "creation",
        display_order: 1,
        ja: "作成",
        en: "Creation",
        vi: "Tạo tài liệu",
    },
    DefaultTerm {
        key: "try-s-review-1",
        display_order: 2,
        ja: "Try-Sレビュー①",
        en: "Try-S Review 1",
        vi: "Đánh giá Try-S lần 1",
    },
    DefaultTerm {
        key: "address-review-comments-1",
        display_order: 3,
        ja: "指摘修正①",
        en: "Address Review Comments 1",
        vi: "Sửa theo góp ý lần 1",
    },
    DefaultTerm {
        key: "try-s-review-2",
        display_order: 4,
        ja: "Try-Sレビュー②",
        en: "Try-S Review 2",
        vi: "Đánh giá Try-S lần 2",
    },
    DefaultTerm {
        key: "toshiba-review",
        display_order: 5,
        ja: "東芝レビュー",
        en: "Toshiba Review",
        vi: "Đánh giá Toshiba",
    },
];

/// The accepted default phases as a slice.
pub fn default_phases() -> [DefaultTerm; 5] {
    DEFAULT_PHASES
}

/* ------------------------------ translations ------------------------------ */

/// One stored translation of a taxonomy term.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalizedLabel {
    pub locale: String,
    pub name: String,
}

/// Locale fallback chain (design doc §4.1):
/// requested locale → project default locale → first available translation →
/// immutable key. `translations` order is the caller's stable order.
pub fn resolve_label<'a>(
    translations: &'a [LocalizedLabel],
    requested: Option<&str>,
    project_default: Option<&str>,
    fallback_key: &'a str,
) -> &'a str {
    if let Some(locale) = requested {
        if let Some(hit) = translations.iter().find(|t| t.locale == locale) {
            return &hit.name;
        }
    }
    if let Some(locale) = project_default {
        if let Some(hit) = translations.iter().find(|t| t.locale == locale) {
            return &hit.name;
        }
    }
    if let Some(first) = translations.first() {
        return &first.name;
    }
    fallback_key
}

/* ------------------------- hierarchy (pure, arbitrary depth) ------------------------- */

/// Flat reference to a (non-deleted) task row — enough for hierarchy and
/// taxonomy-attribute reasoning without dragging full task payloads around.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaskRowRef {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub priority_order: i32,
    pub phase_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
}

/// Materialized hierarchy node. Each node carries ITS OWN phase/category
/// attributes — they are never derived from, or propagated to, relatives.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeNode {
    pub task_id: Uuid,
    pub priority_order: i32,
    pub phase_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub children: Vec<TreeNode>,
}

/// Materialize a forest from flat rows, arbitrary depth, in
/// `(priority_order, task_id)` order. Built from ID → node and parent →
/// children indexes: a child is attached through the index, never through a
/// detached clone, so depth cannot be lost regardless of input row order.
/// Rows whose parent is missing from the input surface as roots.
pub fn materialize_tree(rows: &[TaskRowRef]) -> Vec<TreeNode> {
    // parent -> children ids (stable input order; sorted at assembly).
    let mut children_of: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    let mut present: HashMap<Uuid, ()> = HashMap::new();
    for row in rows {
        present.insert(row.task_id, ());
    }
    let mut roots: Vec<Uuid> = Vec::new();
    for row in rows {
        match row.parent_task_id {
            Some(parent) if present.contains_key(&parent) => {
                children_of.entry(parent).or_default().push(row.task_id);
            }
            _ => roots.push(row.task_id),
        }
    }

    // Recursively assemble from the indexes.
    fn assemble(
        id: Uuid,
        by_id: &HashMap<Uuid, TaskRowRef>,
        children_of: &HashMap<Uuid, Vec<Uuid>>,
    ) -> TreeNode {
        let row = &by_id[&id];
        let mut children: Vec<TreeNode> = children_of
            .get(&id)
            .map(|kids| kids.iter().map(|k| assemble(*k, by_id, children_of)).collect())
            .unwrap_or_default();
        children.sort_by(|a, b| {
            (a.priority_order, a.task_id).cmp(&(b.priority_order, b.task_id))
        });
        TreeNode {
            task_id: id,
            priority_order: row.priority_order,
            phase_id: row.phase_id,
            category_id: row.category_id,
            children,
        }
    }

    let by_id: HashMap<Uuid, TaskRowRef> =
        rows.iter().copied().map(|r| (r.task_id, r)).collect();
    let mut forest: Vec<TreeNode> = roots
        .iter()
        .map(|id| assemble(*id, &by_id, &children_of))
        .collect();
    forest.sort_by(|a, b| (a.priority_order, a.task_id).cmp(&(b.priority_order, b.task_id)));
    forest
}

/* ------------------------- query-side forest assembly ------------------------- */

/// One flat row for the query-side hierarchy projection: a task id, its
/// parent pointer, and whatever payload the caller carries.
#[derive(Debug, Clone)]
pub struct ForestRow<T> {
    pub task_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub payload: T,
}

/// Assembled projection tree: the row's payload plus materialized children.
#[derive(Debug, Clone)]
pub struct ForestTree<T> {
    pub payload: T,
    pub children: Vec<ForestTree<T>>,
}

/// Materialize a forest from flat projection rows.
///
/// Healthy trees keep their exact stable first-encounter order. Corrupt
/// rows never panic and every row still surfaces EXACTLY ONCE:
/// - a row whose parent is missing from the input, or points at itself,
///   becomes a root;
/// - a parent cycle is unreachable from any real root, so after the main
///   assembly every still-unvisited row is appended as a root
///   (diagnostic-safe fallback);
/// - a revisit during assembly (duplicate edge/row) is skipped, never a
///   panic (the previous `expect` crashed the whole query on corrupt data).
pub fn assemble_forest<T>(rows: Vec<ForestRow<T>>) -> Vec<ForestTree<T>> {
    // First row per id wins (exactly-once even on duplicate input rows).
    let mut by_id: HashMap<Uuid, ForestRow<T>> = HashMap::new();
    let mut ids: Vec<Uuid> = Vec::new();
    for row in rows {
        let id = row.task_id;
        if by_id.insert(id, row).is_none() {
            ids.push(id);
        }
    }
    // Parent -> children edges, deduped, in first-encounter order. A
    // self-edge is treated as a corrupt root instead of infinite recursion.
    let mut children_of: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    let mut edge_seen: std::collections::HashSet<(Uuid, Uuid)> = std::collections::HashSet::new();
    let mut roots: Vec<Uuid> = Vec::new();
    for id in &ids {
        let parent = by_id[id].parent_task_id;
        match parent {
            Some(p) if p != *id && by_id.contains_key(&p) => {
                if edge_seen.insert((p, *id)) {
                    children_of.entry(p).or_default().push(*id);
                }
            }
            _ => roots.push(*id),
        }
    }

    fn take<T>(
        id: Uuid,
        by_id: &mut HashMap<Uuid, ForestRow<T>>,
        children_of: &HashMap<Uuid, Vec<Uuid>>,
        visited: &mut std::collections::HashSet<Uuid>,
    ) -> Option<ForestTree<T>> {
        if !visited.insert(id) {
            return None; // corrupt revisit: surface once, never panic
        }
        let children = children_of
            .get(&id)
            .map(|kids| {
                kids.iter()
                    .filter_map(|k| take(*k, by_id, children_of, visited))
                    .collect()
            })
            .unwrap_or_default();
        let row = by_id.remove(&id)?;
        Some(ForestTree { payload: row.payload, children })
    }

    let mut visited: std::collections::HashSet<Uuid> = std::collections::HashSet::new();
    let mut forest: Vec<ForestTree<T>> = roots
        .iter()
        .filter_map(|id| take(*id, &mut by_id, &children_of, &mut visited))
        .collect();
    // Cycle members are unreachable above; surface each once as a root.
    for id in &ids {
        if let Some(tree) = take(*id, &mut by_id, &children_of, &mut visited) {
            forest.push(tree);
        }
    }
    forest
}

/* ------------------------------ reparent rules ------------------------------ */

/// Why a re-parent is illegal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReparentError {
    SelfParent,
    UnknownParent,
    CrossProject,
    WouldCreateCycle,
    UnknownTask,
}

/// Validate moving `task_id` under `new_parent` (None = detach to root).
///
/// Rules (design doc §6): parents must be real tasks of the SAME project; a
/// task cannot be its own parent; the new parent must not be a descendant of
/// the task (cycle). Phase/category are never touched by re-parenting.
pub fn validate_reparent(
    task_id: Uuid,
    new_parent: Option<Uuid>,
    rows: &[TaskRowRef],
) -> Result<(), ReparentError> {
    let by_id: HashMap<Uuid, TaskRowRef> = rows.iter().copied().map(|r| (r.task_id, r)).collect();
    let task = by_id.get(&task_id).ok_or(ReparentError::UnknownTask)?;
    if let Some(parent_id) = new_parent {
        if parent_id == task_id {
            return Err(ReparentError::SelfParent);
        }
        let parent = by_id.get(&parent_id).ok_or(ReparentError::UnknownParent)?;
        if parent.project_id != task.project_id {
            return Err(ReparentError::CrossProject);
        }
        // Walk the candidate parent's ancestor chain; meeting the task means
        // the task would become its own ancestor (cycle).
        let mut cursor = parent.parent_task_id;
        let mut hops = 0usize;
        while let Some(ancestor) = cursor {
            if ancestor == task_id {
                return Err(ReparentError::WouldCreateCycle);
            }
            cursor = by_id.get(&ancestor).and_then(|a| a.parent_task_id);
            hops += 1;
            if hops > rows.len() {
                // Defensive: pre-existing cycles never authorize new ones.
                return Err(ReparentError::WouldCreateCycle);
            }
        }
    }
    Ok(())
}

/* --------------------------------- errors --------------------------------- */

/// Taxonomy service failures.
#[derive(Debug)]
pub enum TaxonomyError {
    Reparent(ReparentError),
    UnknownProject,
    UnknownPhase,
    UnknownCategory,
    InactivePhase,
    InactiveCategory,
    /// Archive strategy is not a conversion at all (e.g. reassigning a
    /// phase's tasks to the very phase being archived).
    InvalidArchiveStrategy,
    Database(sqlx::Error),
}

impl std::fmt::Display for TaxonomyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaxonomyError::Reparent(e) => write!(f, "invalid re-parent: {e:?}"),
            TaxonomyError::UnknownProject => write!(f, "unknown project"),
            TaxonomyError::UnknownPhase => write!(f, "unknown phase for this project"),
            TaxonomyError::UnknownCategory => write!(f, "unknown category for this project"),
            TaxonomyError::InactivePhase => write!(f, "phase is archived"),
            TaxonomyError::InactiveCategory => write!(f, "category is archived"),
            TaxonomyError::InvalidArchiveStrategy => {
                write!(f, "invalid archive strategy: reassign target must differ from the archived phase")
            }
            TaxonomyError::Database(e) => write!(f, "database error: {e}"),
        }
    }
}

impl From<sqlx::Error> for TaxonomyError {
    fn from(e: sqlx::Error) -> Self {
        TaxonomyError::Database(e)
    }
}

impl std::error::Error for TaxonomyError {}

/* ------------------------------ DB services ------------------------------ */

/// A phase row with its translations (stable locale order).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhaseRow {
    pub phase_id: Uuid,
    pub phase_key: String,
    pub display_order: i32,
    pub is_active: bool,
    pub translations: Vec<LocalizedLabel>,
}

/// How a referenced term's tasks are converted when it is archived:
/// atomically reassign to another ACTIVE term of the same project, or
/// explicitly convert them to Unphased (NULL). Archiving a referenced term
/// without one of these is refused by construction.
#[derive(Debug, Clone, Copy)]
pub enum ArchiveStrategy<'a> {
    ReassignTo(&'a Uuid),
    Unphased,
}

/// Insert the five default phases (idempotent). Returns how many phase rows
/// were actually inserted (0 when the project already has its defaults).
pub async fn ensure_default_phases(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<usize, TaxonomyError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM projects WHERE project_id = $1)",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;
    if !exists {
        return Err(TaxonomyError::UnknownProject);
    }
    let inserted: i64 = sqlx::query_scalar(
        r#"
        WITH new_phases AS (
            INSERT INTO project_phases (project_id, phase_key, display_order)
            SELECT $1, seed.key, seed.ord
            FROM (VALUES
                ('creation', 1),
                ('try-s-review-1', 2),
                ('address-review-comments-1', 3),
                ('try-s-review-2', 4),
                ('toshiba-review', 5)
            ) AS seed(key, ord)
            ON CONFLICT DO NOTHING
            RETURNING phase_id, phase_key
        ), inserted_labels AS (
            INSERT INTO project_phase_translations (phase_id, locale, name)
            SELECT np.phase_id, labels.locale, labels.name
            FROM new_phases np
            JOIN (VALUES
                ('creation', 'ja', '作成'),
                ('creation', 'en', 'Creation'),
                ('creation', 'vi', 'Tạo tài liệu'),
                ('try-s-review-1', 'ja', 'Try-Sレビュー①'),
                ('try-s-review-1', 'en', 'Try-S Review 1'),
                ('try-s-review-1', 'vi', 'Đánh giá Try-S lần 1'),
                ('address-review-comments-1', 'ja', '指摘修正①'),
                ('address-review-comments-1', 'en', 'Address Review Comments 1'),
                ('address-review-comments-1', 'vi', 'Sửa theo góp ý lần 1'),
                ('try-s-review-2', 'ja', 'Try-Sレビュー②'),
                ('try-s-review-2', 'en', 'Try-S Review 2'),
                ('try-s-review-2', 'vi', 'Đánh giá Try-S lần 2'),
                ('toshiba-review', 'ja', '東芝レビュー'),
                ('toshiba-review', 'en', 'Toshiba Review'),
                ('toshiba-review', 'vi', 'Đánh giá Toshiba')
            ) AS labels(key, locale, name) ON labels.key = np.phase_key
            ON CONFLICT DO NOTHING
            RETURNING 1
        )
        SELECT count(*) FROM new_phases
        "#,
    )
    .bind(project_id)
    .fetch_one(pool)
    .await?;
    Ok(inserted as usize)
}

/// List a project's phases in display order with their translations.
pub async fn list_project_phases(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<PhaseRow>, TaxonomyError> {
    let phases: Vec<(Uuid, String, i32, bool)> = sqlx::query_as(
        "SELECT phase_id, phase_key, display_order, is_active \
         FROM project_phases WHERE project_id = $1 ORDER BY display_order ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    let translations: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT t.phase_id, t.locale, t.name \
         FROM project_phase_translations t \
         JOIN project_phases p ON p.phase_id = t.phase_id \
         WHERE p.project_id = $1 ORDER BY t.locale ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    let mut by_phase: HashMap<Uuid, Vec<LocalizedLabel>> = HashMap::new();
    for (phase_id, locale, name) in translations {
        by_phase.entry(phase_id).or_default().push(LocalizedLabel { locale, name });
    }
    Ok(phases
        .into_iter()
        .map(|(phase_id, phase_key, display_order, is_active)| PhaseRow {
            phase_id,
            phase_key,
            display_order,
            is_active,
            translations: by_phase.remove(&phase_id).unwrap_or_default(),
        })
        .collect())
}

/// Validate task taxonomy references: any non-NULL phase/category must belong
/// to the SAME project and be active (Unphased/NULL is always valid).
pub async fn validate_term_for_project(
    pool: &PgPool,
    project_id: Uuid,
    phase_id: Option<Uuid>,
    category_id: Option<Uuid>,
) -> Result<(), TaxonomyError> {
    if let Some(phase) = phase_id {
        let row: Option<(bool,)> = sqlx::query_as(
            "SELECT is_active FROM project_phases WHERE phase_id = $1 AND project_id = $2",
        )
        .bind(phase)
        .bind(project_id)
        .fetch_optional(pool)
        .await?;
        match row {
            None => return Err(TaxonomyError::UnknownPhase),
            Some((false,)) => return Err(TaxonomyError::InactivePhase),
            Some((true,)) => {}
        }
    }
    if let Some(category) = category_id {
        let row: Option<(bool,)> = sqlx::query_as(
            "SELECT is_active FROM project_categories WHERE category_id = $1 AND project_id = $2",
        )
        .bind(category)
        .bind(project_id)
        .fetch_optional(pool)
        .await?;
        match row {
            None => return Err(TaxonomyError::UnknownCategory),
            Some((false,)) => return Err(TaxonomyError::InactiveCategory),
            Some((true,)) => {}
        }
    }
    Ok(())
}

/// Fetch the (non-deleted) task rows of a project as flat references.
/// Generic over the executor so callers can read through the SAME open
/// transaction that will perform the write (reparent TOCTOU hardening).
pub async fn fetch_task_refs<'e, E>(
    executor: E,
    project_id: Uuid,
) -> Result<Vec<TaskRowRef>, TaxonomyError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let rows: Vec<(Uuid, Uuid, Option<Uuid>, i32, Option<Uuid>, Option<Uuid>)> = sqlx::query_as(
        "SELECT task_id, project_id, parent_task_id, priority_order, phase_id, category_id \
         FROM tasks WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(project_id)
    .fetch_all(executor)
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(task_id, project_id, parent_task_id, priority_order, phase_id, category_id)| {
                TaskRowRef {
                    task_id,
                    project_id,
                    parent_task_id,
                    priority_order,
                    phase_id,
                    category_id,
                }
            },
        )
        .collect())
}

/// Acquire the per-project transaction-scoped advisory lock that serializes
/// hierarchy mutations. Re-parent validation and the re-parent write MUST be
/// one atomic pair guarded by this lock: without it two concurrent opposing
/// reparents (A under B, B under A) can each pass validation on a stale
/// snapshot and both commit, creating a DB cycle (review P3 TOCTOU). The
/// lock auto-releases at commit/rollback.
pub async fn lock_project_hierarchy<'e, E>(
    executor: E,
    project_id: Uuid,
) -> Result<(), TaxonomyError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 6202401))")
        .bind(project_id.to_string())
        .execute(executor)
        .await?;
    Ok(())
}

/// Re-parent a task after full validation. Validation and the UPDATE run in
/// ONE transaction under `lock_project_hierarchy` so concurrent reparents
/// serialize per project (no validate/commit race). Only `parent_task_id`
/// and `updated_at` are written: phase/category (and every other attribute)
/// are preserved by construction (design doc §6).
pub async fn reparent_task(
    pool: &PgPool,
    task_id: Uuid,
    new_parent: Option<Uuid>,
) -> Result<TaskRowRef, TaxonomyError> {
    let mut tx = pool.begin().await?;
    let current: Option<(Uuid,)> = sqlx::query_as(
        "SELECT project_id FROM tasks WHERE task_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(task_id)
    .fetch_optional(&mut *tx)
    .await?;
    let project_id = current.ok_or(TaxonomyError::Reparent(ReparentError::UnknownTask))?.0;
    lock_project_hierarchy(&mut *tx, project_id).await?;
    let rows = fetch_task_refs(&mut *tx, project_id).await?;
    validate_reparent(task_id, new_parent, &rows).map_err(TaxonomyError::Reparent)?;
    let updated: (Uuid, Uuid, Option<Uuid>, i32, Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "UPDATE tasks SET parent_task_id = $2, updated_at = now() \
         WHERE task_id = $1 AND NOT COALESCE(is_deleted, false) \
         RETURNING task_id, project_id, parent_task_id, priority_order, phase_id, category_id",
    )
    .bind(task_id)
    .bind(new_parent)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let (task_id, project_id, parent_task_id, priority_order, phase_id, category_id) = updated;
    Ok(TaskRowRef {
        task_id,
        project_id,
        parent_task_id,
        priority_order,
        phase_id,
        category_id,
    })
}

/// Validate an archive strategy against the phase being archived.
///
/// Reassigning a phase's tasks to the very phase being archived is not a
/// conversion at all: the UPDATE would be a no-op and live tasks would stay
/// pinned to the term being deactivated (review P2).
pub fn validate_archive_strategy(
    phase_id: Uuid,
    strategy: ArchiveStrategy<'_>,
) -> Result<(), TaxonomyError> {
    if let ArchiveStrategy::ReassignTo(target) = strategy {
        if *target == phase_id {
            return Err(TaxonomyError::InvalidArchiveStrategy);
        }
    }
    Ok(())
}

/// Archive a phase atomically. Every referencing task is converted first
/// (reassigned to `strategy`'s target, or explicitly set Unphased/NULL), then
/// the term is deactivated. Returns the number of converted tasks.
pub async fn archive_phase(
    pool: &PgPool,
    project_id: Uuid,
    phase_id: Uuid,
    strategy: ArchiveStrategy<'_>,
) -> Result<u64, TaxonomyError> {
    // Reject self-reassignment BEFORE any read, task update, or phase
    // deactivation (review P2).
    validate_archive_strategy(phase_id, strategy)?;
    let mut tx = pool.begin().await?;
    let exists: Option<(bool,)> = sqlx::query_as(
        "SELECT is_active FROM project_phases WHERE phase_id = $1 AND project_id = $2 FOR UPDATE",
    )
    .bind(phase_id)
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;
    match exists {
        None => return Err(TaxonomyError::UnknownPhase),
        Some((false,)) => return Ok(0), // already archived; nothing to convert
        Some((true,)) => {}
    }
    let referencing: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM tasks WHERE phase_id = $1 AND NOT COALESCE(is_deleted, false)",
    )
    .bind(phase_id)
    .fetch_one(&mut *tx)
    .await?;
    let converted: u64 = if referencing > 0 {
        match strategy {
            ArchiveStrategy::ReassignTo(target) => {
                let target_active: Option<(bool,)> = sqlx::query_as(
                    "SELECT is_active FROM project_phases \
                     WHERE phase_id = $1 AND project_id = $2",
                )
                .bind(target)
                .bind(project_id)
                .fetch_optional(&mut *tx)
                .await?;
                match target_active {
                    None => return Err(TaxonomyError::UnknownPhase),
                    Some((false,)) => return Err(TaxonomyError::InactivePhase),
                    Some((true,)) => {}
                }
                let result = sqlx::query(
                    "UPDATE tasks SET phase_id = $2, updated_at = now() \
                     WHERE phase_id = $1 AND NOT COALESCE(is_deleted, false)",
                )
                .bind(phase_id)
                .bind(target)
                .execute(&mut *tx)
                .await?;
                result.rows_affected()
            }
            ArchiveStrategy::Unphased => {
                let result = sqlx::query(
                    "UPDATE tasks SET phase_id = NULL, updated_at = now() \
                     WHERE phase_id = $1 AND NOT COALESCE(is_deleted, false)",
                )
                .bind(phase_id)
                .execute(&mut *tx)
                .await?;
                result.rows_affected()
            }
        }
    } else {
        0
    };
    sqlx::query("UPDATE project_phases SET is_active = false, updated_at = now() WHERE phase_id = $1")
        .bind(phase_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(converted)
}
