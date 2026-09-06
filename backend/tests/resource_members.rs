//! Task 1.2 — stable project resource identities (design doc §6.3).
//!
//! PURE tests only (manager scope: no live database, no credentials). The
//! SQL-level guarantees of `20260901000300_create_resource_membership.sql`
//! are validated as migration TEXT in `import_issue_1115_dry_run.rs`
//! companion checks and by the migration fingerprints.
//!
//! Rules under test:
//! - A resource member may be a placeholder: stable ID, REQUIRED display
//!   name, NULLABLE email, NULL user. Linking later preserves the member ID.
//! - Duplicate linked-user conflicts require explicit resolution.
//! - Companies and project groups classify concrete members only; neither is
//!   assignable nor capacity-bearing.

use uuid::Uuid;
use task_scheduler_backend::domain::resource_identity::{
    self, ResourceIdentityError, ResourceMemberIdentity, ResourceMemberKind,
};

fn placeholder(name: &str) -> ResourceMemberIdentity {
    resource_identity::new_placeholder_member(Uuid::new_v4(), name, None)
        .expect("valid placeholder")
}

fn linked_member(name: &str, user_id: Uuid) -> ResourceMemberIdentity {
    let mut member = placeholder(name);
    member.user_id = Some(user_id);
    member
}

/* ------------------------------ placeholders ------------------------------ */

#[test]
fn placeholder_member_exists_without_user_or_email() {
    let project = Uuid::new_v4();
    let member = resource_identity::new_placeholder_member(project, "Shuichi Nakayama", None)
        .expect("placeholder without email is valid");
    assert_eq!(member.project_id, project);
    assert_eq!(member.display_name, "Shuichi Nakayama");
    assert_eq!(member.email, None);
    assert_eq!(member.user_id, None);
    assert_eq!(member.kind, ResourceMemberKind::Member);
    assert!(!member.is_linked());
}

#[test]
fn display_name_is_required_and_trimmed() {
    let project = Uuid::new_v4();
    assert!(matches!(
        resource_identity::new_placeholder_member(project, "", None),
        Err(ResourceIdentityError::EmptyDisplayName)
    ));
    assert!(matches!(
        resource_identity::new_placeholder_member(project, "   \t ", None),
        Err(ResourceIdentityError::EmptyDisplayName)
    ));
    let member =
        resource_identity::new_placeholder_member(project, "  Hanako Yamada  ", None).expect("ok");
    assert_eq!(member.display_name, "Hanako Yamada");
}

#[test]
fn email_is_optional_but_must_not_be_garbage_when_present() {
    let project = Uuid::new_v4();
    assert!(
        resource_identity::new_placeholder_member(project, "A", Some("a@b.co"))
            .is_ok()
    );
    assert!(matches!(
        resource_identity::new_placeholder_member(project, "A", Some("not-an-email")),
        Err(ResourceIdentityError::InvalidEmail(_))
    ));
}

/* ------------------------------ stable linking ------------------------------ */

#[test]
fn linking_a_user_preserves_the_member_id() {
    let project = Uuid::new_v4();
    let user = Uuid::new_v4();
    let mut member = resource_identity::new_placeholder_member(project, "Shuichi Nakayama", None)
        .expect("valid");
    let original_id = member.resource_member_id;
    let others: Vec<ResourceMemberIdentity> = Vec::new();
    resource_identity::link_user(&mut member, user, &others).expect("link succeeds");
    assert_eq!(member.resource_member_id, original_id, "member ID is stable");
    assert_eq!(member.user_id, Some(user));
    assert!(member.is_linked());
    assert!(member.linked_at.is_some(), "link records when it happened");
}

#[test]
fn duplicate_linked_user_conflicts_are_rejected_for_explicit_resolution() {
    let project = Uuid::new_v4();
    let user = Uuid::new_v4();
    let mut first = linked_member("First Member", user);
    first.project_id = project;
    let mut second = placeholder("Second Member");
    second.project_id = project;
    // Same project, same user already linked by `first`.
    match resource_identity::link_user(&mut second, user, &[first.clone()]) {
        Err(ResourceIdentityError::DuplicateLinkedUser { user_id, .. }) => {
            assert_eq!(user_id, user);
        }
        other => panic!("expected DuplicateLinkedUser, got {other:?}"),
    }
    // Second member is untouched by the refused link.
    assert_eq!(second.user_id, None);
    // A different project linking the same user is fine (project-scoped).
    let mut other_project_member = second.clone();
    other_project_member.project_id = Uuid::new_v4();
    assert!(
        resource_identity::link_user(&mut other_project_member, user, &[first]).is_ok()
    );
}

#[test]
fn relinking_the_same_user_to_the_same_member_is_idempotent() {
    let user = Uuid::new_v4();
    let mut member = linked_member("M", user);
    let before = member.clone();
    resource_identity::link_user(&mut member, user, &[]).expect("relink same user is a no-op");
    assert_eq!(member.resource_member_id, before.resource_member_id);
    assert_eq!(member.user_id, Some(user));
}

/* --------------------------- companies & groups --------------------------- */

#[test]
fn companies_and_groups_classify_but_are_never_assignable_or_capacity_bearing() {
    let project = Uuid::new_v4();
    let mut member = placeholder("Concrete Member");
    member.project_id = project;
    member.kind = ResourceMemberKind::Member;
    let mut company = placeholder("Toshiba Corp");
    company.project_id = project;
    company.kind = ResourceMemberKind::Company;
    let mut group = placeholder("Design Team A");
    group.project_id = project;
    group.kind = ResourceMemberKind::Group;

    // Only concrete MEMBER rows are assignable / capacity-bearing.
    assert!(resource_identity::is_assignable(member.kind));
    assert!(!resource_identity::is_assignable(company.kind));
    assert!(!resource_identity::is_assignable(group.kind));

    // Classification: a concrete member may be classified by company/group…
    assert!(resource_identity::validate_classification(&member, &company).is_ok());
    assert!(resource_identity::validate_classification(&member, &group).is_ok());
    // …never the reverse, never a member classifying anyone, never self.
    assert!(matches!(
        resource_identity::validate_classification(&company, &member),
        Err(ResourceIdentityError::NotClassifiable { .. })
    ));
    assert!(matches!(
        resource_identity::validate_classification(&member, &member),
        Err(ResourceIdentityError::NotClassifiable { .. })
    ));
    assert!(matches!(
        resource_identity::validate_classification(&group, &company),
        Err(ResourceIdentityError::NotClassifiable { .. })
    ));
}

#[test]
fn classification_cannot_cross_projects() {
    let project = Uuid::new_v4();
    let mut member = placeholder("Concrete Member");
    member.project_id = project;
    let mut company = placeholder("Toshiba Corp");
    company.kind = ResourceMemberKind::Company;
    company.project_id = Uuid::new_v4(); // different project
    assert!(matches!(
        resource_identity::validate_classification(&member, &company),
        Err(ResourceIdentityError::CrossProject { .. })
    ));
}
