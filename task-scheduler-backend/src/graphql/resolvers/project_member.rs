use async_graphql::{Context, Object, ID, Result, Error};
use chrono::Utc;
use crate::db::{
    ProjectMemberEntity as ProjectMembers,
    ProjectMemberColumn,
    ProjectEntity as Projects,
    UserEntity as Users,
    entities::ProjectMemberActiveModel,
};
use uuid::Uuid;
use crate::graphql::types::{ProjectMember, ProjectRole};

#[derive(Default)]
pub struct ProjectMemberQuery;

#[Object]
impl ProjectMemberQuery {
    /// Get project members with optional filters
    async fn project_members(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<ProjectMember>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let project_id = Uuid::parse_str(&project_id)?;

        let members = ProjectMembers::find()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .all(db)
            .await?;

        Ok(members.into_iter().map(|m| m.into()).collect())
    }

    /// Get specific project member
    async fn project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<Option<ProjectMember>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        let member = ProjectMembers::find()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .filter(ProjectMemberColumn::UserId.eq(user_id))
            .one(db)
            .await?;

        Ok(member.map(|m| m.into()))
    }
}

#[derive(Default)]
pub struct ProjectMemberMutation;

#[Object]
impl ProjectMemberMutation {
    /// Add member to project
    async fn add_project_member(&self, ctx: &Context<'_>, input: AddProjectMemberInput) -> Result<ProjectMember> {
        let db = ctx.data::<DatabaseConnection>()?;
        let project_id = Uuid::parse_str(&input.project_id)?;
        let user_id = Uuid::parse_str(&input.user_id)?;

        // Verify project exists
        if !Projects::find_by_id(project_id).one(db).await?.is_some() {
            return Err(Error::new("Project not found"));
        }

        // Verify user exists
        if !Users::find_by_id(user_id).one(db).await?.is_some() {
            return Err(Error::new("User not found"));
        }

        // Check if member already exists
        if ProjectMembers::find()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .filter(ProjectMemberColumn::UserId.eq(user_id))
            .one(db)
            .await?
            .is_some()
        {
            return Err(Error::new("User is already a member of this project"));
        }

        let now = Utc::now();
        let member = ProjectMemberActiveModel {
            project_id: Set(project_id),
            user_id: Set(user_id),
            role: Set(input.role.to_string()),
            joined_at: Set(now.into()),
            ..Default::default()
        };

        let member = member.insert(db).await?;
        Ok(member.into())
    }

    /// Update project member role
    async fn update_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
        role: ProjectRole,
    ) -> Result<ProjectMember> {
        let db = ctx.data::<DatabaseConnection>()?;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        let member = ProjectMembers::find()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .filter(ProjectMemberColumn::UserId.eq(user_id))
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Project member not found"))?;

        let mut member: ProjectMemberActiveModel = member.into();
        member.role = Set(role.to_string());

        let updated = member.update(db).await?;
        Ok(updated.into())
    }

    /// Remove member from project
    async fn remove_project_member(&self, ctx: &Context<'_>, project_id: ID, user_id: ID) -> Result<bool> {
        let db = ctx.data::<DatabaseConnection>()?;
        let (project_id, user_id) = (Uuid::parse_str(&project_id)?, Uuid::parse_str(&user_id)?);

        ProjectMembers::delete_many()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .filter(ProjectMemberColumn::UserId.eq(user_id))
            .exec(db)
            .await?;

        Ok(true)
    }
}

#[derive(async_graphql::InputObject)]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: ProjectRole,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::ProjectMemberModel;

    #[tokio::test]
    async fn test_add_project_member() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![ProjectMemberModel {
                id: Uuid::new_v4(),
                project_id: Uuid::new_v4(),
                user_id: Uuid::new_v4(),
                role: "EDITOR".to_string(),
                joined_at: Utc::now(),
            }]])
            .into_connection();

        let ctx = Context::default();
        ctx.insert(db);

        let mutation = ProjectMemberMutation::default();
        let result = mutation
            .add_project_member(
                &ctx,
                AddProjectMemberInput {
                    project_id: "123e4567-e89b-12d3-a456-426614174000".into(),
                    user_id: "123e4567-e89b-12d3-a456-426614174001".into(),
                    role: ProjectRole::Editor,
                },
            )
            .await;

        assert!(result.is_ok());
    }
}