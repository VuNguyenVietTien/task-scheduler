//! Task 1.2 — issue-1115 import dry-run validation (design doc §6.2/§9.2).
//!
//! PURE tests only: the dry run consumes a static/synthetic bundle and
//! performs ZERO writes by construction (`dry_run` takes no database handle,
//! is not async, and returns a deterministic report). Live-database evidence
//! for the provenance migration follows the `migration_evidence` conventions
//! and is intentionally NOT run here (manager scope: pure/synthetic tests and
//! migration text/fingerprint validation only).
//!
//! Fixture: `tests/fixtures/issue_1115_manifest.json` — synthetic bundle with
//! exactly 23 `tracker-Phase` headings, 156 `tracker-Task` rows, workflow
//! counts 69/69/6/6/6, exact total effort 387.00h, and issue 1139 at 40.00h /
//! Shuichi Nakayama / WBS row 5.

use rust_decimal::Decimal;
use serde_json::Value;
use task_scheduler_backend::imports::issue_1115::{
    self, DryRunReport, ImportValidationError,
};
use task_scheduler_backend::imports::manifest::{self, ImportManifest};

fn fixture_path() -> String {
    concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/issue_1115_manifest.json"
    )
    .to_string()
}

fn load_fixture() -> ImportManifest {
    manifest::load_manifest_from_path(&fixture_path()).expect("fixture parses")
}

/// Mutate the fixture JSON and re-parse (negative variants).
fn mutated(mutation: impl FnOnce(&mut Value)) -> ImportManifest {
    let raw = std::fs::read_to_string(fixture_path()).expect("fixture readable");
    let mut value: Value = serde_json::from_str(&raw).expect("fixture JSON");
    mutation(&mut value);
    let mutated_raw = serde_json::to_string(&value).expect("re-serialize");
    serde_json::from_str(&mutated_raw).expect("mutated bundle still parses")
}

fn set_task<'a>(value: &'a mut Value, external_id: &str) -> &'a mut Value {
    value
        .get_mut("tasks")
        .expect("tasks")
        .as_array_mut()
        .expect("tasks array")
        .iter_mut()
        .find(|t| t["external_id"].as_str() == Some(external_id))
        .unwrap_or_else(|| panic!("task {external_id} present"))
}

/* ------------------------- happy-path hard gates ------------------------- */

#[test]
fn dry_run_is_a_pure_function_with_zero_database_surface() {
    // Compile-level guarantee: no pool, no async runtime, no clock. Two calls
    // with the same bundle must agree bit-for-bit (deterministic rerun).
    let bundle = load_fixture();
    let first: DryRunReport = issue_1115::dry_run(&bundle).expect("valid bundle");
    let second = issue_1115::dry_run(&bundle).expect("valid bundle");
    assert_eq!(first, second, "dry run must be deterministic on rerun");
    let first_json = serde_json::to_string(&first).expect("report serializable");
    let second_json = serde_json::to_string(&second).expect("report serializable");
    assert_eq!(first_json, second_json);
    assert!(first.diagnostics.is_empty(), "no diagnostics on success");
}

#[test]
fn dry_run_validates_root_1115_detailed_design() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    assert_eq!(report.root_external_id, "1115");
    assert_eq!(report.root_title, "Detailed Design");
}

#[test]
fn dry_run_counts_exactly_23_headings_as_metadata_only() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    assert_eq!(report.heading_count, 23);
    // Root + 23 headings normalize to WBS display groups — nothing else.
    assert_eq!(report.wbs_groups.len(), 1 + 23);
    for group in &report.wbs_groups {
        assert!(!group.external_id.is_empty());
    }
}

#[test]
fn dry_run_counts_exactly_156_real_tasks() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    assert_eq!(report.task_count, 156);
    assert_eq!(report.planned_tasks.len(), 156);
    let unique: std::collections::HashSet<_> = report
        .planned_tasks
        .iter()
        .map(|t| t.external_id.as_str())
        .collect();
    assert_eq!(unique.len(), 156, "planned identities are unique");
}

#[test]
fn dry_run_maps_workflows_69_69_6_6_6_by_immutable_phase_keys() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    assert_eq!(report.phase_counts.len(), 5);
    let expected = [
        ("creation", "Create", 69usize),
        ("try-s-review-1", "Try-S Review 1", 69),
        ("address-review-comments-1", "Address Review Comments 1", 6),
        ("try-s-review-2", "Try-S Review 2", 6),
        ("toshiba-review", "Toshiba Review", 6),
    ];
    assert_eq!(
        report
            .phase_counts
            .iter()
            .map(|p| (p.phase_key.as_str(), p.workflow.as_str(), p.count))
            .collect::<Vec<_>>(),
        expected
    );
}

#[test]
fn dry_run_totals_exactly_387_00_decimal_hours() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    assert_eq!(report.total_effort_hours, Decimal::new(38700, 2));
}

#[test]
fn dry_run_checks_issue_1139_exactly() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    let issue = &report.issue_1139;
    assert_eq!(issue.external_id, "1139");
    assert_eq!(issue.effort_hours, Decimal::new(4000, 2));
    assert_eq!(issue.assignee_display_name, "Shuichi Nakayama");
    assert!(issue.assignee_linked, "p-1 is a known source person");
    assert_eq!(issue.wbs_row, 5);
}

#[test]
fn headings_never_become_task_phase_assignment_dependency_or_capacity_objects() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    let heading_ids: std::collections::HashSet<_> = report
        .wbs_groups
        .iter()
        .skip(1) // root is also metadata-only
        .map(|g| g.external_id.as_str())
        .collect();
    // No heading is planned as a task.
    for task in &report.planned_tasks {
        assert!(
            !heading_ids.contains(task.external_id.as_str()),
            "heading leaked into planned tasks"
        );
        // Headings/phase keys are never task parents.
        if let Some(parent) = &task.parent_task_external_id {
            assert!(!heading_ids.contains(parent.as_str()));
        }
        // A task under a heading carries WBS group metadata, not a fake parent.
        if task.wbs_group_external_id.is_some() {
            assert!(
                task.parent_task_external_id.is_none(),
                "heading-parented task must not gain a task parent"
            );
        }
    }
    // Dependencies reference real task endpoints only.
    for dep in &report.planned_dependencies {
        let ids: std::collections::HashSet<_> = report
            .planned_tasks
            .iter()
            .map(|t| t.external_id.as_str())
            .collect();
        assert!(ids.contains(dep.from_external_id.as_str()));
        assert!(ids.contains(dep.to_external_id.as_str()));
    }
    // Planned assignees are persons/members, never headings or phase keys.
    for member in &report.planned_assignees {
        assert!(!heading_ids.contains(member.display_name.as_str()));
    }
}

#[test]
fn task_under_task_maps_to_parent_task_and_task_under_root_or_heading_to_wbs_metadata() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    // 2003 is under task 2002 (chain 2001 <- 2002 <- 2003).
    let chain = report
        .planned_tasks
        .iter()
        .find(|t| t.external_id == "2003")
        .expect("2003 planned");
    assert_eq!(chain.parent_task_external_id.as_deref(), Some("2002"));
    assert!(chain.wbs_group_external_id.is_none());
    // 1139 is under heading 3001.
    let issue = report
        .planned_tasks
        .iter()
        .find(|t| t.external_id == "1139")
        .expect("1139 planned");
    assert!(issue.parent_task_external_id.is_none());
    assert_eq!(issue.wbs_group_external_id.as_deref(), Some("3001"));
}

/* ------------------------------ rejection gates ------------------------------ */

#[test]
fn duplicate_source_identities_are_rejected() {
    let mut bundle = load_fixture();
    let clone = bundle.tasks[0].clone();
    bundle.tasks.push(clone); // duplicate external_id
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::DuplicateSourceIdentity { external_id }) => {
            assert_eq!(external_id, bundle.tasks[0].external_id);
        }
        other => panic!("expected DuplicateSourceIdentity, got {other:?}"),
    }
}

#[test]
fn hierarchy_cycles_are_rejected_with_a_path() {
    let bundle = mutated(|v| {
        set_task(v, "2001")["parent_kind"] = Value::String("task".into());
        set_task(v, "2001")["parent_external_id"] = Value::String("2002".into());
        set_task(v, "2002")["parent_kind"] = Value::String("task".into());
        set_task(v, "2002")["parent_external_id"] = Value::String("2001".into());
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::HierarchyCycle { path }) => {
            assert!(path.contains("2001") && path.contains("2002"), "path: {path}");
        }
        other => panic!("expected HierarchyCycle, got {other:?}"),
    }
}

#[test]
fn ambiguous_aliases_are_rejected() {
    let bundle = mutated(|v| {
        v["aliases"]
            .as_array_mut()
            .expect("aliases")
            .push(serde_json::json!({"alias": "clash", "person_external_id": "p-1"}));
        v["aliases"]
            .as_array_mut()
            .expect("aliases")
            .push(serde_json::json!({"alias": "clash", "person_external_id": "p-2"}));
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::AmbiguousAlias { alias, candidates }) => {
            assert_eq!(alias, "clash");
            assert_eq!(candidates.len(), 2);
        }
        other => panic!("expected AmbiguousAlias, got {other:?}"),
    }
}

#[test]
fn invalid_workflow_names_are_rejected() {
    let bundle = mutated(|v| {
        set_task(v, "2155")["workflow"] = Value::String("Done".into());
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::UnknownWorkflow { workflow }) => {
            assert_eq!(workflow, "Done");
        }
        other => panic!("expected UnknownWorkflow, got {other:?}"),
    }
}

#[test]
fn wrong_task_count_is_rejected() {
    let mut bundle = load_fixture();
    bundle.tasks.pop();
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::TaskCountMismatch { actual, expected }) => {
            assert_eq!((actual, expected), (155, 156));
        }
        other => panic!("expected TaskCountMismatch, got {other:?}"),
    }
}

#[test]
fn wrong_workflow_counts_are_rejected() {
    // Move one Toshiba Review task to Create: 70/…/5.
    let bundle = mutated(|v| {
        set_task(v, "2150")["workflow"] = Value::String("Create".into());
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::WorkflowCountMismatch {
            workflow,
            actual,
            expected,
            ..
        }) => {
            assert_eq!(workflow, "Create");
            assert_eq!((actual, expected), (70, 69));
        }
        other => panic!("expected WorkflowCountMismatch, got {other:?}"),
    }
}

#[test]
fn wrong_total_effort_is_rejected() {
    let bundle = mutated(|v| {
        set_task(v, "2151")["effort_hours"] = Value::String("6.00".into());
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::TotalEffortMismatch { actual, expected }) => {
            assert_eq!(actual, Decimal::new(38800, 2));
            assert_eq!(expected, Decimal::new(38700, 2));
        }
        other => panic!("expected TotalEffortMismatch, got {other:?}"),
    }
}

#[test]
fn issue_1139_gates_are_enforced() {
    let wrong_assignee = mutated(|v| {
        set_task(v, "1139")["assignee"] = Value::String("p-2".into());
    });
    match issue_1115::dry_run(&wrong_assignee) {
        Err(ImportValidationError::Issue1139Violation { .. }) => {}
        other => panic!("expected Issue1139Violation (assignee), got {other:?}"),
    }
    let wrong_effort = mutated(|v| {
        set_task(v, "1139")["effort_hours"] = Value::String("30.00".into());
    });
    match issue_1115::dry_run(&wrong_effort) {
        Err(ImportValidationError::Issue1139Violation { .. }) => {}
        other => panic!("expected Issue1139Violation (effort), got {other:?}"),
    }
    let wrong_row = mutated(|v| {
        set_task(v, "1139")["wbs_row"] = Value::from(9);
    });
    match issue_1115::dry_run(&wrong_row) {
        Err(ImportValidationError::Issue1139Violation { .. }) => {}
        other => panic!("expected Issue1139Violation (wbs row), got {other:?}"),
    }
}

#[test]
fn wrong_root_is_rejected() {
    let bundle = mutated(|v| {
        v["root"]["external_id"] = Value::String("9999".into());
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::RootMismatch { .. }) => {}
        other => panic!("expected RootMismatch, got {other:?}"),
    }
}

#[test]
fn headings_as_dependency_endpoints_are_rejected() {
    let bundle = mutated(|v| {
        v["dependencies"]
            .as_array_mut()
            .expect("dependencies")
            .push(serde_json::json!({"from_external_id": "3001", "to_external_id": "1139"}));
    });
    match issue_1115::dry_run(&bundle) {
        Err(ImportValidationError::HeadingAsDependencyEndpoint { external_id }) => {
            assert_eq!(external_id, "3001");
        }
        other => panic!("expected HeadingAsDependencyEndpoint, got {other:?}"),
    }
}

#[test]
fn assignee_resolution_prefers_person_id_then_alias_then_placeholder() {
    let report = issue_1115::dry_run(&load_fixture()).expect("valid");
    // p-1 / p-2 resolve as linked source persons.
    assert!(report
        .planned_assignees
        .iter()
        .any(|m| m.display_name == "Shuichi Nakayama" && m.linked));
    // "Ichiro Suzuki" appears as a placeholder (name-only, unambiguous).
    assert!(report
        .planned_assignees
        .iter()
        .any(|m| m.display_name == "Ichiro Suzuki" && !m.linked));
    // No fabricated emails: placeholders carry none.
    for member in &report.planned_assignees {
        if !member.linked {
            assert_eq!(member.email, None, "placeholders are fabricated-user-free");
        }
    }
}
