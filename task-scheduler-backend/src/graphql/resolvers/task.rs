use async_graphql::{Context, Object, ID, Result, Error};
use chrono::{DateTime, Utc};
use sea_orm::{DatabaseConnection, EntityTrait, Set, ActiveModelTrait, QueryFilter, ColumnTrait};
use crate::db::{
    TaskEntity as Tasks,
    TaskColumn,
    TaskModel,
    TaskActiveModel,
    ProjectEntity as Projects,
};
use crate::graphql::types::{Task, TaskStatus, TaskPriority};
use uuid::Uuid;

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    /// Get a specific task by ID
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let task_id = Uuid::parse_str(&id)?;

        match Tasks::find_by_id(task_id).one(db).await? {
            Some(task) => Ok(Some(task.into())),
            None => Ok(None)
        }
    }

    /// Get tasks with optional filters
    async fn tasks(
        &self,
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<TaskStatus>,
        _assignee_id: Option<ID>,
    ) -> Result<Vec<Task>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let mut query = Tasks::find();

        if let Some(pid) = project_id {
            query = query.filter(TaskColumn::ProjectId.eq(Uuid::parse_str(&pid)?));
        }

        if let Some(status) = status {
            query = query.filter(TaskColumn::Status.eq(status.to_string()));
        }

        // TODO: Implement assignee filter after task_assignments table is ready

        let tasks = query.all(db).await?;
        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    /// Create a new task
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        let db = ctx.data::<DatabaseConnection>()?;
        let project_id = Uuid::parse_str(&input.project_id)?;

        // Verify project exists
        if !Projects::find_by_id(project_id).one(db).await?.is_some() {
            return Err(Error::new("Project not found"));
        }

        let now = Utc::now();
        let task = TaskActiveModel {
            project_id: Set(project_id),
            title: Set(input.title),
            description: Set(input.description),
            status: Set(input.status.to_string()),
            priority: Set(match input.priority {
                TaskPriority::Low => 0,
                TaskPriority::Medium => 1,
                TaskPriority::High => 2,
                TaskPriority::Urgent => 3,
            }),
            start_date: Set(input.start_date.map(|dt| dt.into())),
            deadline: Set(input.deadline.map(|dt| dt.into())),
            created_at: Set(now.into()),
            updated_at: Set(now.into()),
            ..Default::default()
        };

        let task = task.insert(db).await?;
        Ok(task.into())
    }

    /// Update task details
    async fn update_task(
        &self,
        ctx: &Context<'_>,
        id: ID,
        title: Option<String>,
        description: Option<String>,
        status: Option<TaskStatus>,
        priority: Option<TaskPriority>,
        start_date: Option<DateTime<Utc>>,
        deadline: Option<DateTime<Utc>>,
    ) -> Result<Task> {
        let db = ctx.data::<DatabaseConnection>()?;
        let task_id = Uuid::parse_str(&id)?;

        let task = Tasks::find_by_id(task_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        let mut task: TaskActiveModel = task.into();

        if let Some(title) = title {
            task.title = Set(title);
        }
        if let Some(desc) = description {
            task.description = Set(desc);
        }
        if let Some(status) = status {
            task.status = Set(status.to_string());
        }
        if let Some(priority) = priority {
            task.priority = Set(match priority {
                TaskPriority::Low => 0,
                TaskPriority::Medium => 1,
                TaskPriority::High => 2,
                TaskPriority::Urgent => 3,
            });
        }
        if let Some(dt) = start_date {
            task.start_date = Set(Some(dt.into()));
        }
        if let Some(dt) = deadline {
            task.deadline = Set(Some(dt.into()));
        }
        task.updated_at = Set(Utc::now().into());

        let updated_task = task.update(db).await?;
        Ok(updated_task.into())
    }

    /// Delete task
    async fn delete_task(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let db = ctx.data::<DatabaseConnection>()?;
        let task_id = Uuid::parse_str(&id)?;

        Tasks::delete_by_id(task_id).exec(db).await?;
        Ok(true)
    }

    /// Update task status
    async fn update_task_status(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        status: TaskStatus,
    ) -> Result<Task> {
        let db = ctx.data::<DatabaseConnection>()?;
        let task_id = Uuid::parse_str(&task_id)?;

        let task = Tasks::find_by_id(task_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        let mut task: TaskActiveModel = task.into();
        task.status = Set(status.to_string());
        task.updated_at = Set(Utc::now().into());

        let updated_task = task.update(db).await?;
        Ok(updated_task.into())
    }
}

#[derive(async_graphql::InputObject)]
pub struct CreateTaskInput {
    project_id: ID,
    title: String,
    description: String,
    status: TaskStatus,
    priority: TaskPriority,
    start_date: Option<DateTime<Utc>>,
    deadline: Option<DateTime<Utc>>,
}

impl From<TaskModel> for Task {
    fn from(model: TaskModel) -> Self {
        Task {
            id: model.id.into(),
            project_id: model.project_id.into(),
            parent_task_id: model.parent_task_id.map(Into::into),
            title: model.title,
            description: if model.description.is_empty() { "".to_string() } else { model.description },
            status: match model.status.as_str() {
                "BACKLOG" => TaskStatus::Backlog,
                "PLANNED" => TaskStatus::Planned,
                "IN_PROGRESS" => TaskStatus::InProgress,
                "IN_REVIEW" => TaskStatus::InReview,
                "DONE" => TaskStatus::Done,
                _ => TaskStatus::Cancelled,
            },
            priority: match model.priority {
                0 => TaskPriority::Low,
                1 => TaskPriority::Medium,
                2 => TaskPriority::High,
                _ => TaskPriority::Urgent,
            },
            effort_hours: model.effort_hours,
            start_date: model.start_date.map(Into::into),
            deadline: model.deadline.map(Into::into),
            created_by: model.created_by.into(),
            created_at: model.created_at.into(),
            updated_at: model.updated_at.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::MockDatabase;

    #[tokio::test]
    async fn test_create_task() {
        let db = MockDatabase::new()
            .append_query_results(vec![vec![TaskModel {
                id: Uuid::new_v4(),
                project_id: Uuid::new_v4(),
                parent_task_id: None,
                title: "Test Task".to_string(),
                description: Some("Test Description".to_string()),
                status: "PLANNED".to_string(),
                priority: 2, // HIGH
                effort_hours: None,
                start_date: Some(Utc::now()),
                deadline: Some(Utc::now()),
                created_by: Uuid::new_v4(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }]])
            .into_connection();

        let ctx = Context::default();
        ctx.insert(db);

        let mutation = TaskMutation::default();
        let result = mutation
            .create_task(
                &ctx,
                CreateTaskInput {
                    project_id: "123e4567-e89b-12d3-a456-426614174000".into(),
                    title: "Test Task".to_string(),
                    description: "Test Description".to_string(),
                    status: TaskStatus::Planned,
                    priority: TaskPriority::High,
                    start_date: Some(Utc::now()),
                    deadline: Some(Utc::now()),
                },
            )
            .await;

        assert!(result.is_ok());
    }
}