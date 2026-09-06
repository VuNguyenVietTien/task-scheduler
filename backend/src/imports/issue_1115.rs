//! Issue-1115 import dry run (design doc §6.2/§9.2).
//!
//! Deterministic, PURE validation of a static manifest: no database, no
//! async runtime, no clock, no network, no writes — the apply path does not
//! exist until Increment 4. The same bundle always yields the same report,
//! so a repeated dry run is byte-stable evidence.
//!
//! Hard gates (spec §9.2):
//! - root `1115` "Detailed Design" is source-root metadata only;
//! - exactly 23 `tracker-Phase` headings → WBS display groups, never
//!   task/phase/assignment/dependency/capacity objects;
//! - exactly 156 `tracker-Task` rows;
//! - workflow mapping by immutable phase keys: Create → creation (69),
//!   Try-S Review 1 → try-s-review-1 (69), Address Review Comments 1 →
//!   address-review-comments-1 (6), Try-S Review 2 → try-s-review-2 (6),
//!   Toshiba Review → toshiba-review (6);
//! - exact total effort 387.00h (rust_decimal, never floats);
//! - issue 1139 = 40.00h, Shuichi Nakayama (linked or placeholder), source
//!   WBS row 5;
//! - duplicate source identities, ambiguous aliases, hierarchy cycles,
//!   invalid workflow names, and heading dependency endpoints are rejected.

use std::collections::{HashMap, HashSet};

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use super::manifest::{ImportManifest, ParentKind};

/* ------------------------------- exact gates ------------------------------- */

pub const EXPECTED_ROOT_ID: &str = "1115";
pub const EXPECTED_ROOT_TITLE: &str = "Detailed Design";
pub const EXPECTED_HEADING_COUNT: usize = 23;
pub const EXPECTED_TASK_COUNT: usize = 156;
pub const EXPECTED_TOTAL_EFFORT: Decimal = Decimal::from_parts(38700, 0, 0, false, 2);

pub const ISSUE_1139_ID: &str = "1139";
pub const ISSUE_1139_EFFORT: Decimal = Decimal::from_parts(4000, 0, 0, false, 2);
pub const ISSUE_1139_ASSIGNEE: &str = "Shuichi Nakayama";
pub const ISSUE_1139_WBS_ROW: i64 = 5;

/// Immutable workflow → phase-key mapping, in phase display order, with the
/// exact expected counts (design doc §4.1/§9.2). Labels are never
/// identifiers: the phase key is.
pub const WORKFLOW_PHASE_MAP: [(&str, &str, usize); 5] = [
    ("Create", "creation", 69),
    ("Try-S Review 1", "try-s-review-1", 69),
    ("Address Review Comments 1", "address-review-comments-1", 6),
    ("Try-S Review 2", "try-s-review-2", 6),
    ("Toshiba Review", "toshiba-review", 6),
];

/* --------------------------------- report --------------------------------- */

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhaseCount {
    pub phase_key: String,
    pub workflow: String,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedWbsGroup {
    pub external_id: String,
    pub title: String,
    pub position: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedTask {
    pub external_id: String,
    pub phase_key: String,
    /// Task-under-task source parent (becomes `parent_task_id` on apply).
    pub parent_task_external_id: Option<String>,
    /// Task-under-root/heading: WBS display metadata, never a task parent.
    pub wbs_group_external_id: Option<String>,
    pub effort_hours: Decimal,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedMember {
    pub display_name: String,
    pub email: Option<String>,
    /// True when resolved to a source person (id or approved alias); false
    /// for name-only placeholders (which carry no fabricated email/user).
    pub linked: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlannedDependency {
    pub from_external_id: String,
    pub to_external_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Issue1139Check {
    pub external_id: String,
    pub effort_hours: Decimal,
    pub assignee_display_name: String,
    pub assignee_linked: bool,
    pub wbs_row: i64,
}

/// Deterministic dry-run outcome. No timestamps: equality of two reports is
/// the deterministic-rerun gate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DryRunReport {
    pub source_system: String,
    pub root_external_id: String,
    pub root_title: String,
    pub heading_count: usize,
    pub task_count: usize,
    pub phase_counts: Vec<PhaseCount>,
    pub total_effort_hours: Decimal,
    pub issue_1139: Issue1139Check,
    pub wbs_groups: Vec<PlannedWbsGroup>,
    pub planned_tasks: Vec<PlannedTask>,
    pub planned_assignees: Vec<PlannedMember>,
    pub planned_dependencies: Vec<PlannedDependency>,
    pub diagnostics: Vec<String>,
}

/* --------------------------------- errors --------------------------------- */

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ImportValidationError {
    RootMismatch { found: String, expected: &'static str },
    InvalidTracker { external_id: String, tracker: String },
    DuplicateSourceIdentity { external_id: String },
    UnknownParent { task_external_id: String, parent_external_id: String },
    InvalidParentKind { task_external_id: String },
    HierarchyCycle { path: String },
    UnknownWorkflow { workflow: String },
    TaskCountMismatch { actual: usize, expected: usize },
    HeadingCountMismatch { actual: usize, expected: usize },
    WorkflowCountMismatch {
        workflow: String,
        phase_key: String,
        actual: usize,
        expected: usize,
    },
    Issue1139Violation { reason: String },
    TotalEffortMismatch { actual: Decimal, expected: Decimal },
    AmbiguousAlias { alias: String, candidates: Vec<String> },
    HeadingAsDependencyEndpoint { external_id: String },
    UnknownDependencyEndpoint { external_id: String },
    InvalidEffort { task_external_id: String, raw: String },
}

impl std::fmt::Display for ImportValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for ImportValidationError {}

/* ------------------------------ assignee policy ------------------------------ */

/// Resolution policy (design doc §9.2): external person ID → approved alias
/// → unique name → placeholder. Ambiguous name/alias matches block.
#[derive(Debug, Clone, PartialEq, Eq)]
enum AssigneeResolution {
    /// Resolved to a source person (person external id, display name).
    Linked { person_external_id: String, display_name: String },
    /// Unambiguous name-only match → placeholder member, stable display name.
    Placeholder { display_name: String },
    Unassigned,
}

fn resolve_assignees(manifest: &ImportManifest) -> Result<HashMap<String, AssigneeResolution>, ImportValidationError> {
    // Alias table: an alias must map to exactly one person.
    let mut alias_to_persons: HashMap<&str, Vec<&str>> = HashMap::new();
    for alias in &manifest.aliases {
        alias_to_persons
            .entry(alias.alias.as_str())
            .or_default()
            .push(alias.person_external_id.as_str());
    }
    for (alias, persons) in &alias_to_persons {
        if persons.len() > 1 {
            return Err(ImportValidationError::AmbiguousAlias {
                alias: (*alias).to_string(),
                candidates: persons.iter().map(|p| p.to_string()).collect(),
            });
        }
    }

    let persons_by_id: HashMap<&str, &str> = manifest
        .persons
        .iter()
        .map(|p| (p.external_id.as_str(), p.display_name.as_str()))
        .collect();
    let mut names_to_persons: HashMap<&str, Vec<&str>> = HashMap::new();
    for person in &manifest.persons {
        names_to_persons
            .entry(person.display_name.as_str())
            .or_default()
            .push(person.external_id.as_str());
    }

    let mut resolved: HashMap<String, AssigneeResolution> = HashMap::new();
    for task in &manifest.tasks {
        let Some(reference) = task.assignee.as_deref() else {
            continue;
        };
        let resolution = if let Some(display_name) = persons_by_id.get(reference) {
            AssigneeResolution::Linked {
                person_external_id: reference.to_string(),
                display_name: display_name.to_string(),
            }
        } else if let Some(persons) = names_to_persons.get(reference) {
            if persons.len() > 1 {
                return Err(ImportValidationError::AmbiguousAlias {
                    alias: reference.to_string(),
                    candidates: persons.iter().map(|p| p.to_string()).collect(),
                });
            }
            AssigneeResolution::Linked {
                person_external_id: persons[0].to_string(),
                display_name: reference.to_string(),
            }
        } else if let Some(persons) = alias_to_persons.get(reference) {
            // Uniqueness enforced above.
            AssigneeResolution::Linked {
                person_external_id: persons[0].to_string(),
                display_name: persons_by_id[persons[0]].to_string(),
            }
        } else {
            AssigneeResolution::Placeholder {
                display_name: reference.to_string(),
            }
        };
        resolved.insert(task.external_id.clone(), resolution);
    }
    Ok(resolved)
}

/* ------------------------------ cycle detection ------------------------------ */

/// Detect self/cyclic task-under-task edges. Returns the offending path
/// ("a -> b -> a") for actionable diagnostics.
fn find_hierarchy_cycle(parent_of: &HashMap<String, String>) -> Option<String> {
    for start in parent_of.keys() {
        let mut path: Vec<String> = vec![start.clone()];
        let mut seen: HashSet<String> = HashSet::from([start.clone()]);
        let mut cursor = parent_of.get(start).cloned();
        while let Some(node) = cursor {
            if node == *start {
                path.push(node);
                return Some(path.join(" -> "));
            }
            if !seen.insert(node.clone()) {
                break; // a cycle not involving `start`; found from its own start
            }
            path.push(node.clone());
            cursor = parent_of.get(&node).cloned();
        }
    }
    None
}

/* --------------------------------- dry run --------------------------------- */

/// Validate a static manifest against every issue-1115 hard gate. PURE:
/// consumes the bundle only, writes nothing, records no time — a dry run has
/// zero database surface by construction.
pub fn dry_run(manifest: &ImportManifest) -> Result<DryRunReport, ImportValidationError> {
    // Root gate.
    if manifest.root.external_id != EXPECTED_ROOT_ID {
        return Err(ImportValidationError::RootMismatch {
            found: manifest.root.external_id.clone(),
            expected: EXPECTED_ROOT_ID,
        });
    }
    if manifest.root.title != EXPECTED_ROOT_TITLE {
        return Err(ImportValidationError::RootMismatch {
            found: manifest.root.title.clone(),
            expected: EXPECTED_ROOT_TITLE,
        });
    }

    // Tracker gates: root/headings/tasks are disjoint kinds by construction.
    let root_id = manifest.root.external_id.clone();
    let mut heading_ids: HashSet<String> = HashSet::new();
    for heading in &manifest.headings {
        if heading.tracker != "Phase" {
            return Err(ImportValidationError::InvalidTracker {
                external_id: heading.external_id.clone(),
                tracker: heading.tracker.clone(),
            });
        }
        if !heading_ids.insert(heading.external_id.clone()) {
            return Err(ImportValidationError::DuplicateSourceIdentity {
                external_id: heading.external_id.clone(),
            });
        }
    }
    let mut task_ids: HashSet<String> = HashSet::new();
    for task in &manifest.tasks {
        if task.tracker != "Task" {
            return Err(ImportValidationError::InvalidTracker {
                external_id: task.external_id.clone(),
                tracker: task.tracker.clone(),
            });
        }
        if !task_ids.insert(task.external_id.clone()) {
            return Err(ImportValidationError::DuplicateSourceIdentity {
                external_id: task.external_id.clone(),
            });
        }
    }
    // Root/headings/tasks must not collide either.
    if task_ids.contains(&root_id) || heading_ids.contains(&root_id) {
        return Err(ImportValidationError::DuplicateSourceIdentity { external_id: root_id });
    }
    for id in &heading_ids {
        if task_ids.contains(id) {
            return Err(ImportValidationError::DuplicateSourceIdentity { external_id: id.clone() });
        }
    }

    // Parent normalization + hierarchy cycle gate.
    let mut parent_task_of: HashMap<String, String> = HashMap::new();
    let mut planned_tasks: Vec<PlannedTask> = Vec::with_capacity(manifest.tasks.len());
    let workflow_of: HashMap<&str, &str> = WORKFLOW_PHASE_MAP
        .iter()
        .map(|(workflow, phase_key, _)| (*workflow, *phase_key))
        .collect();
    let mut phase_counts: HashMap<&str, usize> = HashMap::new();
    let mut total_effort = Decimal::ZERO;

    for task in &manifest.tasks {
        let phase_key = *workflow_of.get(task.workflow.as_str()).ok_or(
            ImportValidationError::UnknownWorkflow {
                workflow: task.workflow.clone(),
            },
        )?;
        *phase_counts.entry(phase_key).or_insert(0) += 1;

        let effort = task.effort().map_err(|_| ImportValidationError::InvalidEffort {
            task_external_id: task.external_id.clone(),
            raw: task.effort_hours.clone(),
        })?;
        if effort < Decimal::ZERO {
            return Err(ImportValidationError::InvalidEffort {
                task_external_id: task.external_id.clone(),
                raw: task.effort_hours.clone(),
            });
        }
        total_effort += effort;

        let parent_kind = task.parent_kind.unwrap_or(match task.parent_external_id.as_deref() {
            Some(id) if id == root_id => ParentKind::Root,
            Some(id) if heading_ids.contains(id) => ParentKind::Heading,
            Some(_) => ParentKind::Task,
            None => ParentKind::Root,
        });
        let (parent_task_external_id, wbs_group_external_id) = match (parent_kind, task.parent_external_id.as_deref()) {
            (ParentKind::Root, None) => (None, Some(root_id.clone())),
            (ParentKind::Root, Some(id)) if id == root_id => (None, Some(root_id.clone())),
            (ParentKind::Heading, Some(id)) if heading_ids.contains(id) => {
                (None, Some(id.to_string()))
            }
            (ParentKind::Task, Some(id)) if task_ids.contains(id) => {
                parent_task_of.insert(task.external_id.clone(), id.to_string());
                (Some(id.to_string()), None)
            }
            (kind, parent) => {
                let parent = parent.unwrap_or("").to_string();
                // A task under a heading/root stays metadata-parented; a
                // heading/root can never become a task parent. Unknown ids
                // are unknown parents.
                let _ = kind;
                return Err(ImportValidationError::UnknownParent {
                    task_external_id: task.external_id.clone(),
                    parent_external_id: parent,
                });
            }
        };

        planned_tasks.push(PlannedTask {
            external_id: task.external_id.clone(),
            phase_key: phase_key.to_string(),
            parent_task_external_id,
            wbs_group_external_id,
            effort_hours: effort,
        });
    }

    if let Some(path) = find_hierarchy_cycle(&parent_task_of) {
        return Err(ImportValidationError::HierarchyCycle { path });
    }

    // Count gates.
    if manifest.headings.len() != EXPECTED_HEADING_COUNT {
        return Err(ImportValidationError::HeadingCountMismatch {
            actual: manifest.headings.len(),
            expected: EXPECTED_HEADING_COUNT,
        });
    }
    if manifest.tasks.len() != EXPECTED_TASK_COUNT {
        return Err(ImportValidationError::TaskCountMismatch {
            actual: manifest.tasks.len(),
            expected: EXPECTED_TASK_COUNT,
        });
    }

    // Issue-1139 gate (before totals: a wrong 1139 effort is a 1139
    // violation, not merely an arithmetic drift).
    let issue_node = manifest
        .tasks
        .iter()
        .find(|t| t.external_id == ISSUE_1139_ID)
        .ok_or_else(|| ImportValidationError::Issue1139Violation {
            reason: format!("task {ISSUE_1139_ID} missing from bundle"),
        })?;
    let assignees = resolve_assignees(manifest)?;
    let issue_assignee = match assignees.get(ISSUE_1139_ID) {
        Some(AssigneeResolution::Linked { display_name, .. }) => (display_name.clone(), true),
        Some(AssigneeResolution::Placeholder { display_name }) => (display_name.clone(), false),
        Some(AssigneeResolution::Unassigned) | None => (String::new(), false),
    };
    let issue_effort = issue_node.effort().map_err(|_| ImportValidationError::InvalidEffort {
        task_external_id: issue_node.external_id.clone(),
        raw: issue_node.effort_hours.clone(),
    })?;
    if issue_effort != ISSUE_1139_EFFORT {
        return Err(ImportValidationError::Issue1139Violation {
            reason: format!("effort {issue_effort} != {ISSUE_1139_EFFORT}"),
        });
    }
    if issue_assignee.0 != ISSUE_1139_ASSIGNEE {
        return Err(ImportValidationError::Issue1139Violation {
            reason: format!("assignee {:?} != {ISSUE_1139_ASSIGNEE:?} (linked or placeholder)", issue_assignee.0),
        });
    }
    if issue_node.wbs_row != ISSUE_1139_WBS_ROW {
        return Err(ImportValidationError::Issue1139Violation {
            reason: format!("wbs row {} != {ISSUE_1139_WBS_ROW}", issue_node.wbs_row),
        });
    }

    // Workflow count gates.
    let mut phase_count_rows = Vec::with_capacity(WORKFLOW_PHASE_MAP.len());
    for (workflow, phase_key, expected) in WORKFLOW_PHASE_MAP {
        let actual = phase_counts.get(phase_key).copied().unwrap_or(0);
        if actual != expected {
            return Err(ImportValidationError::WorkflowCountMismatch {
                workflow: workflow.to_string(),
                phase_key: phase_key.to_string(),
                actual,
                expected,
            });
        }
        phase_count_rows.push(PhaseCount {
            phase_key: phase_key.to_string(),
            workflow: workflow.to_string(),
            count: actual,
        });
    }

    // Total effort gate.
    if total_effort != EXPECTED_TOTAL_EFFORT {
        return Err(ImportValidationError::TotalEffortMismatch {
            actual: total_effort,
            expected: EXPECTED_TOTAL_EFFORT,
        });
    }

    // Dependency gates: endpoints must be real TASK ids — headings, root,
    // phases, and members are invalid endpoints by construction.
    let mut planned_dependencies = Vec::with_capacity(manifest.dependencies.len());
    for dep in &manifest.dependencies {
        for endpoint in [&dep.from_external_id, &dep.to_external_id] {
            if heading_ids.contains(endpoint) || endpoint == &root_id {
                return Err(ImportValidationError::HeadingAsDependencyEndpoint {
                    external_id: endpoint.clone(),
                });
            }
            if !task_ids.contains(endpoint) {
                return Err(ImportValidationError::UnknownDependencyEndpoint {
                    external_id: endpoint.clone(),
                });
            }
        }
        planned_dependencies.push(PlannedDependency {
            from_external_id: dep.from_external_id.clone(),
            to_external_id: dep.to_external_id.clone(),
        });
    }

    // Planned members (deduped, stable order by first appearance).
    let mut planned_assignees: Vec<PlannedMember> = Vec::new();
    let mut seen_members: HashSet<(String, bool)> = HashSet::new();
    for task in &manifest.tasks {
        let Some(resolution) = assignees.get(&task.external_id) else {
            continue;
        };
        let member = match resolution {
            AssigneeResolution::Linked { display_name, .. } => PlannedMember {
                display_name: display_name.clone(),
                email: None,
                linked: true,
            },
            AssigneeResolution::Placeholder { display_name } => PlannedMember {
                display_name: display_name.clone(),
                // Placeholder: no fabricated email/user (design doc §6.3/§13).
                email: None,
                linked: false,
            },
            AssigneeResolution::Unassigned => continue,
        };
        if seen_members.insert((member.display_name.clone(), member.linked)) {
            planned_assignees.push(member);
        }
    }

    // WBS display groups: root (position 0) + every heading, in position
    // order. These are metadata rows only.
    let mut wbs_groups = vec![PlannedWbsGroup {
        external_id: root_id.clone(),
        title: manifest.root.title.clone(),
        position: 0,
    }];
    let mut heading_groups: Vec<PlannedWbsGroup> = manifest
        .headings
        .iter()
        .map(|h| PlannedWbsGroup {
            external_id: h.external_id.clone(),
            title: h.title.clone(),
            position: h.position,
        })
        .collect();
    heading_groups.sort_by_key(|g| g.position);
    wbs_groups.extend(heading_groups);

    Ok(DryRunReport {
        source_system: manifest.source_system.clone(),
        root_external_id: root_id,
        root_title: manifest.root.title.clone(),
        heading_count: manifest.headings.len(),
        task_count: manifest.tasks.len(),
        phase_counts: phase_count_rows,
        total_effort_hours: total_effort,
        issue_1139: Issue1139Check {
            external_id: ISSUE_1139_ID.to_string(),
            effort_hours: issue_effort,
            assignee_display_name: issue_assignee.0,
            assignee_linked: issue_assignee.1,
            wbs_row: issue_node.wbs_row,
        },
        wbs_groups,
        planned_tasks,
        planned_assignees,
        planned_dependencies,
        diagnostics: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_gates_match_the_accepted_spec() {
        assert_eq!(EXPECTED_ROOT_ID, "1115");
        assert_eq!(EXPECTED_HEADING_COUNT, 23);
        assert_eq!(EXPECTED_TASK_COUNT, 156);
        assert_eq!(EXPECTED_TOTAL_EFFORT, Decimal::new(38700, 2));
        assert_eq!(ISSUE_1139_EFFORT, Decimal::new(4000, 2));
        let counts: Vec<usize> = WORKFLOW_PHASE_MAP.iter().map(|(_, _, c)| *c).collect();
        assert_eq!(counts, vec![69, 69, 6, 6, 6]);
        let keys: Vec<&str> = WORKFLOW_PHASE_MAP.iter().map(|(_, k, _)| *k).collect();
        assert_eq!(
            keys,
            vec![
                "creation",
                "try-s-review-1",
                "address-review-comments-1",
                "try-s-review-2",
                "toshiba-review"
            ]
        );
    }

    #[test]
    fn cycle_detection_reports_the_path() {
        let mut parents = std::collections::HashMap::new();
        parents.insert("a".to_string(), "b".to_string());
        parents.insert("b".to_string(), "a".to_string());
        let path = find_hierarchy_cycle(&parents).expect("cycle found");
        assert!(path.starts_with("a -> b -> a"));
        // Self-parent is the shortest cycle.
        let mut self_parent = std::collections::HashMap::new();
        self_parent.insert("x".to_string(), "x".to_string());
        assert_eq!(find_hierarchy_cycle(&self_parent).as_deref(), Some("x -> x"));
        // A clean chain has no cycle.
        let mut chain = std::collections::HashMap::new();
        chain.insert("c".to_string(), "p".to_string());
        assert!(find_hierarchy_cycle(&chain).is_none());
    }
}
