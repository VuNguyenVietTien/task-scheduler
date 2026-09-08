//! Pure project member, settings, and timesheet permission rules.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProjectRole {
    Manager,
    Leader,
    Member,
    Guest,
}

impl ProjectRole {
    pub fn parse(value: &str) -> Option<Self> {
        match value.to_ascii_lowercase().as_str() {
            "manager" | "admin" => Some(Self::Manager),
            "leader" => Some(Self::Leader),
            "member" => Some(Self::Member),
            "guest" | "viewer" => Some(Self::Guest),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ProjectActor {
    pub is_owner: bool,
    pub role: Option<ProjectRole>,
}

impl ProjectActor {
    pub fn can_view_members(self) -> bool {
        self.is_owner
            || matches!(
                self.role,
                Some(ProjectRole::Manager | ProjectRole::Leader | ProjectRole::Member)
            )
    }

    pub fn can_add_members(self) -> bool {
        self.is_owner || matches!(self.role, Some(ProjectRole::Manager | ProjectRole::Leader))
    }

    pub fn can_view_settings(self) -> bool {
        self.is_owner || self.role == Some(ProjectRole::Manager)
    }

    pub fn can_assign_role(self, role: ProjectRole) -> bool {
        self.is_owner
            || self.role == Some(ProjectRole::Manager)
            || (self.role == Some(ProjectRole::Leader)
                && matches!(role, ProjectRole::Member | ProjectRole::Guest))
    }

    pub fn can_remove(
        self,
        target_is_owner: bool,
        target_role: Option<ProjectRole>,
        is_self: bool,
    ) -> bool {
        if target_is_owner {
            return false;
        }
        if self.is_owner {
            return true;
        }
        match self.role {
            Some(ProjectRole::Manager) => is_self || target_role != Some(ProjectRole::Manager),
            Some(ProjectRole::Leader) => {
                is_self
                    || matches!(
                        target_role,
                        None | Some(ProjectRole::Member | ProjectRole::Guest)
                    )
            }
            _ => false,
        }
    }

    pub fn can_view_timesheet(self, own: bool) -> bool {
        own || self.is_owner
            || matches!(self.role, Some(ProjectRole::Manager | ProjectRole::Leader))
    }

    pub fn can_edit_timesheet(self, own: bool) -> bool {
        own || self.is_owner || self.role == Some(ProjectRole::Manager)
    }
}
