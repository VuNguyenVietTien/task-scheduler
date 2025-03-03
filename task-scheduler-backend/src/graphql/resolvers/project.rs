use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, 
    IntoActiveModel, Set,
};
use uuid::Uuid;

use crate::{
    db::entities::{
        ProjectEntity, ProjectModel, ProjectActiveModel,
        ProjectMemberEntity, ProjectMemberModel, ProjectMemberActiveModel,
        project::Column as ProjectColumn,
        project_member::Column as ProjectMemberColumn,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{Project, ProjectMember, CreateProjectInput, UpdateProjectInput, AddProjectMemberInput},
    },
};

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn project(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Project>, Error> {
        let db = ctx.get_db();
        let project = ProjectEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(project.map(|p| p.into()))
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Project>, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        let projects = if auth_user.is_admin() {
            ProjectEntity::find()
                .all(db)
                .await
                .map_err(map_db_err)?
        } else {
            // Only return projects user is member of
            let members = ProjectMemberEntity::find()
                .filter(ProjectMemberColumn::UserId.eq(auth_user.id))
                .all(db)
                .await
                .map_err(map_db_err)?;
                
            let project_ids: Vec<_> = members.into_iter()
                .map(|m| m.project_id)
                .collect();
                
            ProjectEntity::find()
                .filter(ProjectColumn::Id.is_in(project_ids))
                .all(db)
                .await
                .map_err(map_db_err)?
        };

        Ok(projects.into_iter().map(|p| p.into()).collect())
    }
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<Project, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        let project = ProjectActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(input.name),
            description: Set(input.description),
            created_by: Set(auth_user.id),
            created_at: Set(current_time_db()),
            updated_at: Set(current_time_db()),
        };

        let project = project.insert(db).await.map_err(map_db_err)?;

        // Add creator as admin member
        let member = ProjectMemberActiveModel {
            project_id: Set(project.id),
            user_id: Set(auth_user.id),
            role: Set("admin".to_string()),
            joined_at: Set(current_time_db()),
        };

        member.insert(db).await.map_err(map_db_err)?;

        Ok(project.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn add_project_member(
        &self,
        ctx: &Context<'_>,
        input: AddProjectMemberInput,
    ) -> Result<ProjectMember, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        // Check if user is project admin
        let project_id = Uuid::parse_str(&input.project_id.to_string())?;
        let user_id = Uuid::parse_str(&input.user_id.to_string())?;

        let member = ProjectMemberEntity::find()
            .filter(ProjectMemberColumn::ProjectId.eq(project_id))
            .filter(ProjectMemberColumn::UserId.eq(auth_user.id))
            .one(db)
            .await
            .map_err(map_db_err)?;

        if member.is_none() {
            return Err("Not a project member".into());
        }

        let new_member = ProjectMemberActiveModel {
            project_id: Set(project_id),
            user_id: Set(user_id),
            role: Set(input.role),
            joined_at: Set(current_time_db()),
        };

        let member = new_member.insert(db).await.map_err(map_db_err)?;

        Ok(member.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn update_project(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: UpdateProjectInput,
    ) -> Result<Project, Error> {
        let db = ctx.get_db();
        let project_id = Uuid::parse_str(&id.to_string())?;

        let mut project = ProjectEntity::find_by_id(project_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Project not found"))?
            .into_active_model();

        project.name = Set(input.name);
        project.description = Set(input.description);
        project.updated_at = Set(current_time_db());

        let project = project.update(db).await.map_err(map_db_err)?;

        Ok(project.into())
    }
}

impl From<ProjectModel> for Project {
    fn from(model: ProjectModel) -> Self {
        Project {
            id: model.id.into(),
            name: model.name,
            description: model.description,
            created_by: model.created_by.into(),
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}

impl From<ProjectMemberModel> for ProjectMember {
    fn from(model: ProjectMemberModel) -> Self {
        ProjectMember {
            project_id: model.project_id.into(),
            user_id: model.user_id.into(),
            role: model.role,
            joined_at: model.joined_at,
        }
    }
}
