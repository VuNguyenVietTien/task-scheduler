use async_graphql::*;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
    IntoActiveModel, Set,
};
use uuid::Uuid;

use crate::{
    db::entities::{
        TaskEntity, TaskModel, TaskActiveModel,
        task::Column as TaskColumn,
    },
    graphql::{
        context::ContextExt,
        map_db_err,
        resolvers::mutation_utils::current_time_db,
        types::{Task, CreateTaskInput, ReorderTasksInput},
    },
};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>, Error> {
        let db = ctx.get_db();
        let task = TaskEntity::find_by_id(Uuid::parse_str(&id.to_string())?)
            .one(db)
            .await
            .map_err(map_db_err)?;

        Ok(task.map(|t| t.into()))
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn tasks(
        &self,
        ctx: &Context<'_>,
        project_id: Option<ID>,
    ) -> Result<Vec<Task>, Error> {
        let db = ctx.get_db();
        let mut query = TaskEntity::find();

        if let Some(pid) = project_id {
            query = query.filter(TaskColumn::ProjectId.eq(Uuid::parse_str(&pid.to_string())?));
        }

        let tasks = query
            .order_by(TaskColumn::CreatedAt, sea_orm::Order::Desc)
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
    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn create_task(
        &self,
        ctx: &Context<'_>,
        input: CreateTaskInput,
    ) -> Result<Task, Error> {
        let db = ctx.get_db();
        let auth_user = ctx.require_auth()?;

        let task = TaskActiveModel {
            id: Set(Uuid::new_v4()),
            project_id: Set(Uuid::parse_str(&input.project_id.to_string())?),
            parent_task_id: Set(input.parent_task_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?),
            title: Set(input.title),
            description: Set(input.description),
            status: Set(input.status),
            priority: Set(input.priority),
            effort_hours: Set(input.effort_hours),
            start_date: Set(input.start_date),
            deadline: Set(input.deadline),
            created_by: Set(auth_user.id),
            created_at: Set(current_time_db()),
            updated_at: Set(current_time_db()),
        };

        let task = task.insert(db).await.map_err(map_db_err)?;

        Ok(task.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn update_task(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: CreateTaskInput,
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
        task.status = Set(input.status);
        task.priority = Set(input.priority);
        task.effort_hours = Set(input.effort_hours);
        task.start_date = Set(input.start_date);
        task.deadline = Set(input.deadline);
        task.updated_at = Set(current_time_db());

        let task = task.update(db).await.map_err(map_db_err)?;

        Ok(task.into())
    }

    #[graphql(guard = "crate::graphql::resolvers::guards::auth()")]
    async fn reorder_tasks(
        &self,
        ctx: &Context<'_>,
        input: ReorderTasksInput,
    ) -> Result<Vec<Task>, Error> {
        let db = ctx.get_db();
        let mut results = Vec::new();

        for order in input.task_orders {
            let task_id = Uuid::parse_str(&order.task_id.to_string())?;
            
            let mut task = TaskEntity::find_by_id(task_id)
                .one(db)
                .await
                .map_err(map_db_err)?
                .ok_or_else(|| Error::new("Task not found"))?
                .into_active_model();

            task.updated_at = Set(current_time_db());

            let task = task.update(db).await.map_err(map_db_err)?;
            results.push(task);
        }

        Ok(results.into_iter().map(|t| t.into()).collect())
    }
}

impl From<TaskModel> for Task {
    fn from(model: TaskModel) -> Self {
        Task {
            id: model.id.into(),
            project_id: model.project_id.into(),
            parent_task_id: model.parent_task_id.map(Into::into),
            title: model.title,
            description: model.description,
            status: model.status,
            priority: model.priority,
            effort_hours: model.effort_hours,
            start_date: model.start_date,
            deadline: model.deadline,
            created_by: model.created_by.into(),
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}
