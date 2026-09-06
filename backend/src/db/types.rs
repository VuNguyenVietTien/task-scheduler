use async_graphql::Enum;
use serde::{Deserialize, Serialize};
use sqlx::Type;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "member_role", rename_all = "lowercase")]
pub enum MemberRole {
    Manager,
    Leader,
    Member,
    Guest,
}

impl Default for MemberRole {
    fn default() -> Self {
        Self::Member
    }
}

impl FromStr for MemberRole {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "manager" | "admin" | "owner" => Ok(MemberRole::Manager),
            "leader" => Ok(MemberRole::Leader),
            "member" => Ok(MemberRole::Member),
            "guest" | "viewer" => Ok(MemberRole::Guest),
            _ => Err(format!("Invalid member role: {}", s)),
        }
    }
}

impl AsRef<str> for MemberRole {
    fn as_ref(&self) -> &str {
        match self {
            MemberRole::Manager => "manager",
            MemberRole::Leader => "leader",
            MemberRole::Member => "member",
            MemberRole::Guest => "guest",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "project_status", rename_all = "lowercase")]
pub enum ProjectStatus {
    Active,
    Archived,
    Completed,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        Self::Active
    }
}

impl FromStr for ProjectStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(ProjectStatus::Active),
            "archived" => Ok(ProjectStatus::Archived),
            "completed" => Ok(ProjectStatus::Completed),
            _ => Err(format!("Invalid project status: {}", s)),
        }
    }
}

impl AsRef<str> for ProjectStatus {
    fn as_ref(&self) -> &str {
        match self {
            ProjectStatus::Active => "active",
            ProjectStatus::Archived => "archived",
            ProjectStatus::Completed => "completed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "project_priority", rename_all = "lowercase")]
pub enum ProjectPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Default for ProjectPriority {
    fn default() -> Self {
        Self::Medium
    }
}

impl FromStr for ProjectPriority {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(ProjectPriority::Low),
            "medium" => Ok(ProjectPriority::Medium),
            "high" => Ok(ProjectPriority::High),
            "urgent" => Ok(ProjectPriority::Urgent),
            _ => Err(format!("Invalid project priority: {}", s)),
        }
    }
}

impl AsRef<str> for ProjectPriority {
    fn as_ref(&self) -> &str {
        match self {
            ProjectPriority::Low => "low",
            ProjectPriority::Medium => "medium",
            ProjectPriority::High => "high",
            ProjectPriority::Urgent => "urgent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, Enum)]
#[sqlx(type_name = "project_visibility", rename_all = "lowercase")]
pub enum ProjectVisibility {
    Public,
    Private,
    Team,
}

impl Default for ProjectVisibility {
    fn default() -> Self {
        Self::Private
    }
}

impl FromStr for ProjectVisibility {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "public" => Ok(ProjectVisibility::Public),
            "private" => Ok(ProjectVisibility::Private),
            "team" => Ok(ProjectVisibility::Team),
            _ => Err(format!("Invalid project visibility: {}", s)),
        }
    }
}

impl AsRef<str> for ProjectVisibility {
    fn as_ref(&self) -> &str {
        match self {
            ProjectVisibility::Public => "public",
            ProjectVisibility::Private => "private",
            ProjectVisibility::Team => "team",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: i64,
    pub per_page: i64,
}

impl PaginationParams {
    pub fn new(page: i64, per_page: i64) -> Self {
        Self {
            page: page.max(1),
            per_page: per_page.clamp(1, 100),
        }
    }

    pub fn limit(&self) -> i64 {
        self.per_page
    }

    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.per_page
    }
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 1,
            per_page: 10,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortDirection {
    Asc,
    Desc,
}

impl Default for SortDirection {
    fn default() -> Self {
        Self::Asc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_role_fromstr() {
        assert_eq!(
            MemberRole::from_str("manager").unwrap(),
            MemberRole::Manager
        );
        assert_eq!(MemberRole::from_str("leader").unwrap(), MemberRole::Leader);
        assert_eq!(MemberRole::from_str("member").unwrap(), MemberRole::Member);
        assert_eq!(MemberRole::from_str("guest").unwrap(), MemberRole::Guest);
        // Backward compat
        assert_eq!(MemberRole::from_str("admin").unwrap(), MemberRole::Manager);
        assert_eq!(MemberRole::from_str("owner").unwrap(), MemberRole::Manager);
        assert_eq!(MemberRole::from_str("viewer").unwrap(), MemberRole::Guest);
        assert!(MemberRole::from_str("invalid").is_err());
    }

    #[test]
    fn test_project_status_fromstr() {
        assert_eq!(
            ProjectStatus::from_str("active").unwrap(),
            ProjectStatus::Active
        );
        assert_eq!(
            ProjectStatus::from_str("archived").unwrap(),
            ProjectStatus::Archived
        );
        assert_eq!(
            ProjectStatus::from_str("completed").unwrap(),
            ProjectStatus::Completed
        );
        assert!(ProjectStatus::from_str("invalid").is_err());
    }

    #[test]
    fn test_project_priority_fromstr() {
        assert_eq!(
            ProjectPriority::from_str("low").unwrap(),
            ProjectPriority::Low
        );
        assert_eq!(
            ProjectPriority::from_str("medium").unwrap(),
            ProjectPriority::Medium
        );
        assert_eq!(
            ProjectPriority::from_str("high").unwrap(),
            ProjectPriority::High
        );
        assert!(ProjectPriority::from_str("invalid").is_err());
    }

    #[test]
    fn test_project_visibility_fromstr() {
        assert_eq!(
            ProjectVisibility::from_str("public").unwrap(),
            ProjectVisibility::Public
        );
        assert_eq!(
            ProjectVisibility::from_str("private").unwrap(),
            ProjectVisibility::Private
        );
        assert_eq!(
            ProjectVisibility::from_str("team").unwrap(),
            ProjectVisibility::Team
        );
        assert!(ProjectVisibility::from_str("invalid").is_err());
    }

    #[test]
    fn test_pagination_params() {
        let params = PaginationParams::new(0, 0);
        assert_eq!(params.page, 1);
        assert_eq!(params.per_page, 1);

        let params = PaginationParams::new(2, 50);
        assert_eq!(params.page, 2);
        assert_eq!(params.per_page, 50);
        assert_eq!(params.limit(), 50);
        assert_eq!(params.offset(), 50);

        let params = PaginationParams::new(3, 200);
        assert_eq!(params.page, 3);
        assert_eq!(params.per_page, 100);
        assert_eq!(params.limit(), 100);
        assert_eq!(params.offset(), 200);
    }
}
