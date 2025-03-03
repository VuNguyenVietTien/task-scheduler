use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, EntityTrait, IntoActiveModel, Set,
};
use uuid::Uuid;
use serde_json::Value as JsonValue;
use log::debug;

use crate::{
    db::{
        entities::{
            ProjectEntity, ProjectModel, ProjectActiveModel,
            ProjectMemberModel, ProjectMemberActiveModel,
        },
        enums::{ProjectStatus, ProjectPriority, ProjectVisibility, MemberRole},
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{Project, CreateProjectInput, UpdateProjectInput,
            ProjectStatusEnum, ProjectPriorityEnum, ProjectVisibilityEnum},
    },
};

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn project(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Project>, Error> {
        let db = ctx.get_db();
        let project = ProjectEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(project.map(|p| p.into()))
    }

    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Project>, Error> {
        let db = ctx.get_db();
        let projects = ProjectEntity::find()
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(projects.into_iter().map(|p| p.into()).collect())
    }
}

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(
        &self,
        ctx: &Context<'_>,
        input: CreateProjectInput,
    ) -> Result<Project, Error> {
        let db = ctx.get_db();
        
        // Use a default user ID for testing
        let user_id = Uuid::parse_str("7541b39e-4f4f-449e-82a2-ea22e8d6a580")?;

        debug!("Creating project with status: {:?}", input.status);
        debug!("Creating project with priority: {:?}", input.priority);
        debug!("Creating project with visibility: {:?}", input.visibility);

        let project = ProjectActiveModel {
            id: Set(Uuid::new_v4()),
            name: Set(input.name),
            description: Set(input.description),
            created_by: Set(user_id),
            created_at: Set(current_time_db()),
            updated_at: Set(current_time_db()),
            status: Set(input.status
                .map(ProjectStatus::from)
                .unwrap_or_default()
                .to_string()),
            priority: Set(input.priority
                .map(ProjectPriority::from)
                .unwrap_or_default()
                .to_string()),
            category: Set(input.category),
            metadata: Set(Some(JsonValue::Object(serde_json::Map::new()))),
            visibility: Set(input.visibility
                .map(ProjectVisibility::from)
                .unwrap_or_default()
                .to_string()),
            tags: Set(Some(JsonValue::Array(vec![]))),
            progress: Set(0.0),
        };

        let project = project.insert(db).await.map_err(map_db_err)?;

        // Add creator as admin member
        let member = ProjectMemberActiveModel {
            project_id: Set(project.id),
            user_id: Set(user_id),
            role: Set(MemberRole::Owner.to_string()),
            joined_at: Set(current_time_db()),
        };

        member.insert(db).await.map_err(map_db_err)?;

        Ok(project.into())
    }

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

        if let Some(status) = input.status {
            project.status = Set(ProjectStatus::from(status).to_string());
        }

        if let Some(priority) = input.priority {
            project.priority = Set(ProjectPriority::from(priority).to_string());
        }

        if let Some(category) = input.category {
            project.category = Set(Some(category));
        }

        if let Some(visibility) = input.visibility {
            project.visibility = Set(ProjectVisibility::from(visibility).to_string());
        }

        if let Some(progress) = input.progress {
            if progress < 0.0 || progress > 100.0 {
                return Err(Error::new("Progress must be between 0 and 100"));
            }
            project.progress = Set(progress);
        }
        project.updated_at = Set(current_time_db());

        let project = project.update(db).await.map_err(map_db_err)?;

        Ok(project.into())
    }
}

impl From<ProjectModel> for Project {
    fn from(model: ProjectModel) -> Self {
        let status: ProjectStatus = serde_json::from_str(&format!("\"{}\"", model.status))
            .unwrap_or_default();
        let status_enum = ProjectStatusEnum::from(status);

        let priority: ProjectPriority = serde_json::from_str(&format!("\"{}\"", model.priority))
            .unwrap_or_default();
        let priority_enum = ProjectPriorityEnum::from(priority);

        let visibility: ProjectVisibility = serde_json::from_str(&format!("\"{}\"", model.visibility))
            .unwrap_or_default();
        let visibility_enum = ProjectVisibilityEnum::from(visibility);

        Project {
            id: model.id.into(),
            name: model.name,
            description: model.description,
            created_by: model.created_by.into(),
            created_at: model.created_at,
            updated_at: model.updated_at,
            status: status_enum,
            priority: priority_enum,
            category: model.category,
            metadata: model.metadata.map(Json),
            visibility: visibility_enum,
            tags: model.tags.map(Json),
            progress: model.progress,
        }
    }
}
