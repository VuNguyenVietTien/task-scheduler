use async_graphql::*;
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, QueryOrder, Condition};
use uuid::Uuid;
use crate::{
    db::entities::{project, task, user},
    error::AppError,
    graphql::types::*,
};

pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn project(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Project>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let project_id = Uuid::parse_str(id.as_str())?;

        let project = project::Entity::find_by_id(project_id)
            .one(db)
            .await?
            .map(Into::into);

        Ok(project)
    }

    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Project>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        // In a real app, we would filter projects based on user's access
        let projects = project::Entity::find()
            .order_by_asc(project::Column::CreatedAt)
            .all(db)
            .await?;

        Ok(projects.into_iter().map(Into::into).collect())
    }
}

pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<Project> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        // Verify user has permission to create projects
        if !auth_user.can_manage_project() {
            return Err(Error::new("Unauthorized to create projects"));
        }

        // Create project
        let project = project::ActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(input.name),
            description: Set(input.description),
            created_by: Set(auth_user.id),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
        };

        let project = project.insert(db).await?;

        // Add creator as project owner
        // Implementation note: In a real app, we would create a
        // project_members entry here with OWNER role

        Ok(project.into())
    }

    async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        input: AddProjectMemberInput,
    ) -> Result<ProjectMember> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let project_id = Uuid::parse_str(input.project_id.as_str())?;
        let user_id = Uuid::parse_str(input.user_id.as_str())?;

        // Verify project exists
        let project = project::Entity::find_by_id(project_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Project not found"))?;

        // Verify user exists
        let user = user::Entity::find_by_id(user_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("User not found"))?;

        // Verify current user has permission to add members
        // Implementation note: In a real app, we would verify the user's
        // role in the project (OWNER or MANAGER)

        // Create project member
        let member = ProjectMember {
            project_id: project_id.into(),
            user_id: user_id.into(),
            role: input.role,
            joined_at: chrono::Utc::now().into(),
        };

        Ok(member)
    }

    async fn update_project(
        &self,
        ctx: &Context<'_>,
        id: ID,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Project> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let project_id = Uuid::parse_str(id.as_str())?;
        
        // Fetch existing project
        let project = project::Entity::find_by_id(project_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Project not found"))?;

        // Verify user has permission to update
        // Implementation note: In a real app, we would check project_members table

        // Update project
        let mut project: project::ActiveModel = project.into();
        
        if let Some(name) = name {
            project.name = Set(name);
        }
        
        if let Some(description) = description {
            project.description = Set(Some(description));
        }
        
        project.updated_at = Set(chrono::Utc::now().into());

        let updated_project = project.update(db).await?;

        Ok(updated_project.into())
    }
}

// Implement conversion from database model to GraphQL type
impl From<project::Model> for Project {
    fn from(model: project::Model) -> Self {
        Project {
            id: model.id.into(),
            name: model.name,
            description: model.description,
            created_by: model.created_by.into(),
            created_at: model.created_at.into(),
            updated_at: model.updated_at.into(),
        }
    }
}
