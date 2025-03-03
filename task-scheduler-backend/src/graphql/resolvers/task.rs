use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, EntityTrait, IntoActiveModel, QueryFilter, ColumnTrait,
    DeleteResult, Set,
};
use uuid::Uuid;
use log::debug;

use crate::{
    db::{
        entities::{
            TaskEntity, TaskModel, TaskActiveModel,
        },
        enums::{TaskStatus, TaskPriority},
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{Task, CreateTaskInput, UpdateTaskInput, TaskStatusEnum, TaskPriorityEnum},
    },
};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>, Error> {
        let db = ctx.get_db();
        let task = TaskEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(task.map(|t| t.into()))
    }

    async fn tasks(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<Task>, Error> {
        let db = ctx.get_db();
        let project_uuid = Uuid::parse_str(&project_id.to_string())?;

        let tasks = TaskEntity::find()
            .filter(crate::db::entities::task::Column::ProjectId.eq(project_uuid))
            .all(db)
            .await
            .map_err(map_db_err)?;

        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(
        &self,
        ctx: &Context<'_>,
        input: CreateTaskInput,
    ) -> Result<Task, Error> {
        let db = ctx.get_db();
        
        // Use default user ID for testing
        let user_id = Uuid::parse_str("7541b39e-4f4f-449e-82a2-ea22e8d6a580")?;
        
        debug!("Creating task with status: {:?}", input.status);
        debug!("Creating task with priority: {:?}", input.priority);

        let project_id = Uuid::parse_str(&input.project_id.to_string())?;

        let task = TaskActiveModel {
            id: Set(Uuid::new_v4()),
            project_id: Set(project_id),
            parent_task_id: Set(None),
            title: Set(input.title),
            description: Set(input.description), 
            status: Set(input.status
                .map(TaskStatus::from)
                .unwrap_or_default()
                .to_string()),
            priority: Set(input.priority
                .map(TaskPriority::from)
                .unwrap_or_default()
                .to_string()),
            effort_hours: Set(input.effort_hours),
            start_date: Set(input.start_date),
            deadline: Set(input.deadline),
            created_by: Set(user_id),
            created_at: Set(current_time_db()),
            updated_at: Set(current_time_db()),
        };

        let task = task.insert(db).await.map_err(map_db_err)?;

        Ok(task.into())
    }

    async fn update_task(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: UpdateTaskInput,
    ) -> Result<Task, Error> {
        let db = ctx.get_db();
        let task_id = Uuid::parse_str(&id.to_string())?;

        let mut task = TaskEntity::find_by_id(task_id)
            .one(db)
            .await
            .map_err(map_db_err)?
            .ok_or_else(|| Error::new("Task not found"))?
            .into_active_model();

        task.title = Set(input.title);
        task.description = Set(input.description);

        if let Some(status) = input.status {
            task.status = Set(TaskStatus::from(status).to_string());
        }

        if let Some(priority) = input.priority {
            task.priority = Set(TaskPriority::from(priority).to_string());
        }

        if let Some(effort_hours) = input.effort_hours {
            task.effort_hours = Set(Some(effort_hours));
        }

        if let Some(start_date) = input.start_date {
            task.start_date = Set(Some(start_date));
        }

        if let Some(deadline) = input.deadline {
            task.deadline = Set(Some(deadline));
        }

        task.updated_at = Set(current_time_db());

        let task = task.update(db).await.map_err(map_db_err)?;

        Ok(task.into())
    }

    async fn delete_task(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<ID, Error> {
        let db = ctx.get_db();
        let task_id = Uuid::parse_str(&id.to_string())?;

        let result = TaskEntity::delete_by_id(task_id)
            .exec(db)
            .await
            .map_err(map_db_err)?;

        if result.rows_affected > 0 {
            Ok(id)
        } else {
            Err(Error::new("Task not found"))
        }
    }
}

impl From<TaskModel> for Task {
    fn from(model: TaskModel) -> Self {
        let status: TaskStatus = serde_json::from_str(&format!("\"{}\"", model.status))
            .unwrap_or_default();
        let status_enum = TaskStatusEnum::from(status);

        let priority: TaskPriority = serde_json::from_str(&format!("\"{}\"", model.priority))
            .unwrap_or_default();
        let priority_enum = TaskPriorityEnum::from(priority);

        Task {
            id: model.id.into(),
            project_id: model.project_id.into(),
            title: model.title,
            description: model.description,
            status: status_enum,
            priority: priority_enum,
            effort_hours: model.effort_hours,
            start_date: model.start_date,
            deadline: model.deadline,
            created_by: model.created_by.into(),
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}
