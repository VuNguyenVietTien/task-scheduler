//! Stable project resource identities (design doc §6.3).
//!
//! A project member may be linked to a real user OR remain a PLACEHOLDER:
//! stable `resource_member_id`, required display name, optional email. No
//! user or email is ever fabricated. Linking later preserves the member ID.
//! Duplicate linked-user conflicts require explicit resolution.
//!
//! Companies and project groups CLASSIFY concrete members only. Neither is
//! assignable nor capacity-bearing: `is_assignable` is true for
//! [`ResourceMemberKind::Member`] alone, and classification edges always run
//! classifier (COMPANY/GROUP) → classified (MEMBER), same project.
//!
//! SQL counterparts live in `20260901000300_create_resource_membership.sql`.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Concrete vs classification kinds. Only `Member` rows can receive
/// assignments/allocations in later increments.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceMemberKind {
    /// A concrete person (linked or placeholder) — the only assignable,
    /// capacity-bearing kind.
    Member,
    /// A company: classification/filtering only.
    Company,
    /// A project group: classification/filtering only.
    Group,
}

impl ResourceMemberKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ResourceMemberKind::Member => "MEMBER",
            ResourceMemberKind::Company => "COMPANY",
            ResourceMemberKind::Group => "GROUP",
        }
    }
}

/// One project-scoped resource identity. The `resource_member_id` is STABLE:
/// linking a user mutates `user_id`/`linked_at` only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceMemberIdentity {
    pub resource_member_id: Uuid,
    pub project_id: Uuid,
    pub display_name: String,
    pub email: Option<String>,
    pub user_id: Option<Uuid>,
    pub kind: ResourceMemberKind,
    pub linked_at: Option<DateTime<Utc>>,
}

/// Resource identity rule violations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResourceIdentityError {
    EmptyDisplayName,
    InvalidEmail(String),
    /// Another member of the SAME project already links this user; an
    /// explicit resolution (unlink the other member or pick another user) is
    /// required — never a silent rebind.
    DuplicateLinkedUser { user_id: Uuid, existing_member_id: Uuid },
    /// The classifier is not a COMPANY/GROUP row (or the target is not a
    /// concrete MEMBER): classification edges are classifier → member only.
    NotClassifiable { classifier_kind: ResourceMemberKind, target_kind: ResourceMemberKind },
    CrossProject { member_project: Uuid, classifier_project: Uuid },
}

impl std::fmt::Display for ResourceIdentityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResourceIdentityError::EmptyDisplayName => write!(f, "display name is required"),
            ResourceIdentityError::InvalidEmail(e) => write!(f, "invalid email: {e}"),
            ResourceIdentityError::DuplicateLinkedUser { user_id, existing_member_id } => write!(
                f,
                "user {user_id} already linked by member {existing_member_id} of this project — resolve explicitly"
            ),
            ResourceIdentityError::NotClassifiable { classifier_kind, target_kind } => write!(
                f,
                "classification requires COMPANY/GROUP -> MEMBER, got {classifier_kind:?} -> {target_kind:?}"
            ),
            ResourceIdentityError::CrossProject { member_project, classifier_project } => write!(
                f,
                "classification cannot cross projects ({member_project} vs {classifier_project})"
            ),
        }
    }
}

impl std::error::Error for ResourceIdentityError {}

fn validate_display_name(raw: &str) -> Result<String, ResourceIdentityError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ResourceIdentityError::EmptyDisplayName);
    }
    Ok(trimmed.to_string())
}

fn validate_email(raw: &str) -> Result<String, ResourceIdentityError> {
    // Deliberately light (KISS): one @, non-empty local/domain with a dot in
    // the domain. Real delivery validation is out of scope for identity.
    let trimmed = raw.trim();
    let Some((local, domain)) = trimmed.split_once('@') else {
        return Err(ResourceIdentityError::InvalidEmail(raw.to_string()));
    };
    if local.is_empty() || !domain.contains('.') || domain.starts_with('.') || domain.ends_with('.') {
        return Err(ResourceIdentityError::InvalidEmail(raw.to_string()));
    }
    Ok(trimmed.to_string())
}

impl ResourceMemberIdentity {
    /// True once a real user is linked (placeholder while false).
    pub fn is_linked(&self) -> bool {
        self.user_id.is_some()
    }
}

/// Create a fresh placeholder identity: stable ID, required display name,
/// optional email, NO user. Importers use exactly this for unresolved
/// name-only assignees (design doc §9.2).
pub fn new_placeholder_member(
    project_id: Uuid,
    display_name: &str,
    email: Option<&str>,
) -> Result<ResourceMemberIdentity, ResourceIdentityError> {
    Ok(ResourceMemberIdentity {
        resource_member_id: Uuid::new_v4(),
        project_id,
        display_name: validate_display_name(display_name)?,
        email: email.map(validate_email).transpose()?,
        user_id: None,
        kind: ResourceMemberKind::Member,
        linked_at: None,
    })
}

/// Only concrete MEMBER rows are assignable / capacity-bearing.
pub fn is_assignable(kind: ResourceMemberKind) -> bool {
    matches!(kind, ResourceMemberKind::Member)
}

/// Link a user to a placeholder/existing member. The member ID NEVER
/// changes; a duplicate link (same project + same user on another member) is
/// rejected for explicit resolution. Relinking the SAME member to the SAME
/// user is an idempotent no-op.
pub fn link_user(
    member: &mut ResourceMemberIdentity,
    user_id: Uuid,
    project_members: &[ResourceMemberIdentity],
) -> Result<(), ResourceIdentityError> {
    if member.user_id == Some(user_id) {
        if member.linked_at.is_none() {
            member.linked_at = Some(Utc::now());
        }
        return Ok(());
    }
    for other in project_members {
        if other.project_id == member.project_id
            && other.resource_member_id != member.resource_member_id
            && other.user_id == Some(user_id)
        {
            return Err(ResourceIdentityError::DuplicateLinkedUser {
                user_id,
                existing_member_id: other.resource_member_id,
            });
        }
    }
    member.user_id = Some(user_id);
    member.linked_at = Some(Utc::now());
    Ok(())
}

/// Classification edges: a concrete MEMBER may be classified by a COMPANY or
/// GROUP of the SAME project. Groups/companies never classify each other,
/// members never classify anything, and self-classification is impossible.
pub fn validate_classification(
    member: &ResourceMemberIdentity,
    classifier: &ResourceMemberIdentity,
) -> Result<(), ResourceIdentityError> {
    if member.project_id != classifier.project_id {
        return Err(ResourceIdentityError::CrossProject {
            member_project: member.project_id,
            classifier_project: classifier.project_id,
        });
    }
    let valid = member.kind == ResourceMemberKind::Member
        && matches!(
            classifier.kind,
            ResourceMemberKind::Company | ResourceMemberKind::Group
        )
        && member.resource_member_id != classifier.resource_member_id;
    if valid {
        Ok(())
    } else {
        Err(ResourceIdentityError::NotClassifiable {
            classifier_kind: classifier.kind,
            target_kind: member.kind,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_validation_accepts_and_rejects_sensibly() {
        assert!(validate_email("a@b.co").is_ok());
        assert!(validate_email(" first.last @sub.example.org ").is_ok());
        assert!(matches!(
            validate_email("not-an-email"),
            Err(ResourceIdentityError::InvalidEmail(_))
        ));
        assert!(matches!(
            validate_email("@b.co"),
            Err(ResourceIdentityError::InvalidEmail(_))
        ));
        assert!(matches!(
            validate_email("a@b"),
            Err(ResourceIdentityError::InvalidEmail(_))
        ));
    }
}
