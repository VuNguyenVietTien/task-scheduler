//! Pure current-field schedule projection — Increment 1, task 1.3.
//!
//! Producer for `projectScheduleProjection(projectId)` with
//! `source: CURRENT_TASK_FIELDS`: phase groups in exact display order plus an
//! explicit Unphased group, WBS rows (tasks + DISTINCT source headings), and
//! rollups computed ONCE per real task regardless of hierarchy depth (flat
//! single pass over the task list — never per tree level).
//!
//! NO dependency on capacity/allocation/meeting/schedule-engine tables or
//! services. Increment 2 migrates effort to exact decimals; until then the
//! legacy float effort is returned as a normalized display decimal string
//! (two-decimal `rust_decimal` rendering, e.g. `7.5f64` → `"7.50"`).
//!
//! MOUNTING NOTE: this file is compiled through the `#[path]` module
//! declaration in `graphql/resolvers/schedule_projection/mod.rs` (schema
//! composition owns `resolvers/mod.rs`; `lib.rs`/`main.rs` registration is
//! deliberately out of task-1.3 ownership).

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub const SOURCE_CURRENT_TASK_FIELDS: &str = "CURRENT_TASK_FIELDS";
pub const UNPHASED_KEY: &str = "unphased";

/* --------------------------------- inputs --------------------------------- */

/// Current task fields needed by the projection (resolver fills from `tasks`).
#[derive(Debug, Clone)]
pub struct TaskFieldRow {
    pub task_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub phase_id: Option<Uuid>,
    pub start_date: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    /// Legacy float effort hours (Increment 2 replaces with NUMERIC(10,2)).
    pub effort: Option<f64>,
    /// Integer percent progress.
    pub progress: Option<i32>,
    /// Source WBS heading placement (metadata only; never a task parent).
    pub wbs_group_id: Option<Uuid>,
}

/// Active phase ordering input (resolver fills from `project_phases`).
#[derive(Debug, Clone)]
pub struct PhaseOrderRow {
    pub phase_id: Uuid,
    pub phase_key: String,
    pub display_order: i32,
}

/// Source WBS heading input (resolver fills from `wbs_groups`).
#[derive(Debug, Clone)]
pub struct HeadingRow {
    pub group_id: Uuid,
    pub parent_group_id: Option<Uuid>,
    pub source_system: String,
    pub external_id: String,
    pub title: String,
    pub position: i32,
}

/* --------------------------------- outputs -------------------------------- */

#[derive(Debug, Clone, PartialEq)]
pub struct ScheduleTaskEntry {
    pub task_id: Uuid,
    pub title: String,
    pub phase_id: Option<Uuid>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    /// Normalized display decimal string (legacy float until Increment 2).
    pub effort_hours: String,
    pub progress: Option<f64>,
    pub depth: usize,
}

/// Source headings are a DISTINCT row kind: no task id, no bar callbacks, no
/// schedule numbers — display/provenance metadata only.
#[derive(Debug, Clone, PartialEq)]
pub struct ScheduleSourceHeading {
    pub heading_id: Uuid,
    pub source_system: String,
    pub external_id: String,
    pub title: String,
    pub depth: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ScheduleWbsRow {
    Task(ScheduleTaskEntry),
    Heading(ScheduleSourceHeading),
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ScheduleTotals {
    pub task_count: usize,
    pub effort_hours: String,
    /// Effort-weighted mean progress over tasks that carry a progress value.
    pub progress: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SchedulePhaseGroup {
    /// `None` for the explicit Unphased group.
    pub phase_id: Option<Uuid>,
    pub phase_key: String,
    pub is_unphased: bool,
    pub task_ids: Vec<Uuid>,
    pub totals: ScheduleTotals,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProjectionOutput {
    pub project_id: Uuid,
    pub source: &'static str,
    /// Exact phase display order, then the explicit Unphased group LAST.
    pub phase_groups: Vec<SchedulePhaseGroup>,
    /// Flat pre-order WBS traversal: headings + tasks with depths.
    pub wbs_rows: Vec<ScheduleWbsRow>,
    pub totals: ScheduleTotals,
}

/* --------------------------------- helpers -------------------------------- */

/// Legacy float effort → normalized display decimal string (`"7.50"`, `"0.00"`).
pub fn display_effort(effort: Option<f64>) -> String {
    let dec = match effort {
        Some(v) if v.is_finite() && v >= 0.0 => Decimal::from_f64_retain(v).unwrap_or_default(),
        _ => Decimal::ZERO,
    };
    format!("{:.2}", dec)
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Rollup over a set of tasks: ONE flat pass, each real task contributing
/// exactly once. Grouping is by `phase_id` equality — hierarchy depth is
/// irrelevant because parent/child relationships are not traversed here.
fn rollup(tasks: &[&TaskFieldRow]) -> ScheduleTotals {
    let mut effort = Decimal::ZERO;
    let mut progress_num = 0.0_f64;
    let mut progress_den = 0.0_f64;
    let mut start: Option<DateTime<Utc>> = None;
    let mut end: Option<DateTime<Utc>> = None;
    for t in tasks {
        effort += match t.effort {
            Some(v) if v.is_finite() && v >= 0.0 => {
                Decimal::from_f64_retain(v).unwrap_or_default().round_dp(2)
            }
            _ => Decimal::ZERO,
        };
        if let Some(p) = t.progress {
            // Weight by effort when positive, else equal weight.
            let w = t.effort.filter(|e| *e > 0.0).unwrap_or(1.0);
            progress_num += p as f64 * w;
            progress_den += w;
        }
        if let Some(s) = t.start_date {
            start = Some(match start {
                Some(cur) if cur <= s => cur,
                _ => s,
            });
        }
        if let Some(d) = t.due_date {
            end = Some(match end {
                Some(cur) if cur >= d => cur,
                _ => d,
            });
        }
    }
    ScheduleTotals {
        task_count: tasks.len(),
        effort_hours: format!("{:.2}", effort),
        progress: if progress_den > 0.0 {
            Some(round2(progress_num / progress_den))
        } else {
            None
        },
        start_date: start,
        end_date: end,
    }
}

/* ------------------------------- projector -------------------------------- */

pub fn build_projection(
    project_id: Uuid,
    tasks: &[TaskFieldRow],
    phases: &[PhaseOrderRow],
    headings: &[HeadingRow],
) -> ProjectionOutput {
    // ---- phase groups: exact display order, then explicit Unphased LAST ----
    let mut ordered_phases: Vec<&PhaseOrderRow> = phases.iter().collect();
    ordered_phases.sort_by(|a, b| {
        (a.display_order, &a.phase_key).cmp(&(b.display_order, &b.phase_key))
    });
    let active_phase_ids: HashSet<Uuid> = ordered_phases.iter().map(|p| p.phase_id).collect();

    let mut groups_by_phase: HashMap<Uuid, Vec<&TaskFieldRow>> = HashMap::new();
    let mut unphased: Vec<&TaskFieldRow> = Vec::new();
    for t in tasks {
        match t.phase_id {
            Some(pid) if active_phase_ids.contains(&pid) => {
                groups_by_phase.entry(pid).or_default().push(t);
            }
            // NULL, or a phase not in the active set (e.g. archived leftover)
            // → explicit Unphased. Never dropped.
            _ => unphased.push(t),
        }
    }

    let mut phase_groups: Vec<SchedulePhaseGroup> = ordered_phases
        .into_iter()
        .map(|p| {
            let members = groups_by_phase.remove(&p.phase_id).unwrap_or_default();
            let task_ids = members.iter().map(|t| t.task_id).collect::<Vec<_>>();
            SchedulePhaseGroup {
                phase_id: Some(p.phase_id),
                phase_key: p.phase_key.clone(),
                is_unphased: false,
                totals: rollup(&members),
                task_ids,
            }
        })
        .collect();
    phase_groups.push(SchedulePhaseGroup {
        phase_id: None,
        phase_key: UNPHASED_KEY.to_string(),
        is_unphased: true,
        totals: rollup(&unphased),
        task_ids: unphased.iter().map(|t| t.task_id).collect(),
    });

    // ---- WBS rows: headings (source metadata) + real tasks, pre-order ----
    let mut wbs_rows: Vec<ScheduleWbsRow> = Vec::with_capacity(tasks.len() + headings.len());
    let heading_by_id: HashMap<Uuid, &HeadingRow> =
        headings.iter().map(|h| (h.group_id, h)).collect();
    // Heading children (subheadings) in stable (position, external_id) order.
    let mut heading_children: HashMap<Uuid, Vec<&HeadingRow>> = HashMap::new();
    let mut root_headings: Vec<&HeadingRow> = Vec::new();
    for h in headings {
        match h.parent_group_id {
            Some(p) if p != h.group_id && heading_by_id.contains_key(&p) => {
                heading_children.entry(p).or_default().push(h);
            }
            _ => root_headings.push(h),
        }
    }
    for list in heading_children.values_mut() {
        list.sort_by(|a, b| (a.position, &a.external_id).cmp(&(b.position, &b.external_id)));
    }
    root_headings.sort_by(|a, b| (a.position, &a.external_id).cmp(&(b.position, &b.external_id)));

    // Task children by parent task; tasks grouped under a heading.
    let mut task_children: HashMap<Uuid, Vec<&TaskFieldRow>> = HashMap::new();
    let mut tasks_under_heading: HashMap<Uuid, Vec<&TaskFieldRow>> = HashMap::new();
    let mut root_tasks: Vec<&TaskFieldRow> = Vec::new();
    let task_ids: HashSet<Uuid> = tasks.iter().map(|t| t.task_id).collect();
    for t in tasks {
        let attached_to_heading = t
            .wbs_group_id
            .is_some_and(|g| heading_by_id.contains_key(&g));
        match (t.parent_task_id, attached_to_heading) {
            (Some(p), _) if p != t.task_id && task_ids.contains(&p) => {
                task_children.entry(p).or_default().push(t);
            }
            (_, true) => {
                tasks_under_heading.entry(t.wbs_group_id.unwrap()).or_default().push(t);
            }
            _ => root_tasks.push(t),
        }
    }

    let mut visited: HashSet<Uuid> = HashSet::new();
    fn push_heading_children(
        rows: &mut Vec<ScheduleWbsRow>,
        heading_children: &HashMap<Uuid, Vec<&HeadingRow>>,
        tasks_under_heading: &HashMap<Uuid, Vec<&TaskFieldRow>>,
        task_children: &HashMap<Uuid, Vec<&TaskFieldRow>>,
        visited: &mut HashSet<Uuid>,
        group_id: Uuid,
        depth: usize,
    ) {
        if !visited.insert(group_id) {
            return; // heading cycle: surface once
        }
        if let Some(subs) = heading_children.get(&group_id) {
            for sub in subs {
                rows.push(ScheduleWbsRow::Heading(ScheduleSourceHeading {
                    heading_id: sub.group_id,
                    source_system: sub.source_system.clone(),
                    external_id: sub.external_id.clone(),
                    title: sub.title.clone(),
                    depth,
                }));
                push_heading_children(
                    rows,
                    heading_children,
                    tasks_under_heading,
                    task_children,
                    visited,
                    sub.group_id,
                    depth + 1,
                );
            }
        }
        if let Some(grouped) = tasks_under_heading.get(&group_id) {
            for t in grouped {
                push_task_subtree(rows, task_children, t, depth);
            }
        }
    }
    fn push_task_subtree(
        rows: &mut Vec<ScheduleWbsRow>,
        task_children: &HashMap<Uuid, Vec<&TaskFieldRow>>,
        t: &TaskFieldRow,
        depth: usize,
    ) {
        rows.push(ScheduleWbsRow::Task(ScheduleTaskEntry {
            task_id: t.task_id,
            title: t.title.clone(),
            phase_id: t.phase_id,
            start_date: t.start_date,
            end_date: t.due_date,
            effort_hours: display_effort(t.effort),
            progress: t.progress.map(|p| p as f64),
            depth,
        }));
        if let Some(children) = task_children.get(&t.task_id) {
            for child in children {
                push_task_subtree(rows, task_children, child, depth + 1);
            }
        }
    }

    for h in root_headings {
        wbs_rows.push(ScheduleWbsRow::Heading(ScheduleSourceHeading {
            heading_id: h.group_id,
            source_system: h.source_system.clone(),
            external_id: h.external_id.clone(),
            title: h.title.clone(),
            depth: 0,
        }));
        push_heading_children(
            &mut wbs_rows,
            &heading_children,
            &tasks_under_heading,
            &task_children,
            &mut visited,
            h.group_id,
            1,
        );
    }
    for t in root_tasks {
        push_task_subtree(&mut wbs_rows, &task_children, t, 0);
    }

    let totals = rollup(&tasks.iter().collect::<Vec<_>>());

    ProjectionOutput {
        project_id,
        source: SOURCE_CURRENT_TASK_FIELDS,
        phase_groups,
        wbs_rows,
        totals,
    }
}
