use task_scheduler_backend::domain::project_permissions::{ProjectActor, ProjectRole::*};

fn actor(
    role: Option<task_scheduler_backend::domain::project_permissions::ProjectRole>,
) -> ProjectActor {
    ProjectActor {
        is_owner: false,
        role,
    }
}

#[test]
fn member_and_settings_matrix_is_least_privilege() {
    assert!(actor(Some(Manager)).can_add_members());
    assert!(actor(Some(Leader)).can_add_members());
    assert!(!actor(Some(Member)).can_add_members());
    assert!(actor(Some(Member)).can_view_members());
    assert!(!actor(Some(Guest)).can_view_members());
    assert!(actor(Some(Manager)).can_view_settings());
    assert!(!actor(Some(Leader)).can_view_settings());
    assert!(actor(Some(Leader)).can_assign_role(Member));
    assert!(!actor(Some(Leader)).can_assign_role(Manager));
}

#[test]
fn removal_matrix_protects_owner_and_peer_managers() {
    let owner = ProjectActor {
        is_owner: true,
        role: Some(Manager),
    };
    assert!(owner.can_remove(false, Some(Manager), false));
    assert!(!owner.can_remove(true, Some(Manager), false));

    let manager = actor(Some(Manager));
    assert!(manager.can_remove(false, Some(Manager), true));
    assert!(!manager.can_remove(false, Some(Manager), false));
    assert!(manager.can_remove(false, Some(Leader), false));

    let leader = actor(Some(Leader));
    assert!(leader.can_remove(false, Some(Leader), true));
    assert!(!leader.can_remove(false, Some(Leader), false));
    assert!(leader.can_remove(false, Some(Member), false));
    assert!(leader.can_remove(false, Some(Guest), false));
}

#[test]
fn timesheet_matrix_separates_read_and_edit() {
    for role in [Manager, Leader, Member, Guest] {
        assert!(actor(Some(role)).can_view_timesheet(true));
        assert!(actor(Some(role)).can_edit_timesheet(true));
    }
    assert!(actor(Some(Manager)).can_edit_timesheet(false));
    assert!(actor(Some(Leader)).can_view_timesheet(false));
    assert!(!actor(Some(Leader)).can_edit_timesheet(false));
    assert!(!actor(Some(Member)).can_view_timesheet(false));
}

#[test]
fn graphql_contract_exposes_explicit_transfer_and_timesheet_target() {
    let schema = include_str!("../schema.graphql");
    assert!(schema
        .contains("transfer_project_ownership(project_id: ID!, new_owner_user_id: ID!): Boolean!"));
    assert!(schema.contains(
        "my_timesheet_entries(project_id: ID!, from: NaiveDate!, to: NaiveDate!, user_id: ID)"
    ));
    assert!(schema.contains("input SaveTimesheetBatchInput {\n\tproject_id: ID!\n\tuser_id: ID"));
}
