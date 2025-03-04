use async_graphql::*;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sqlx::PgPool;
use crate::db::models::Task as TaskModel;
use crate::db::queries::task;
use crate::graphql::types::{
    Task, TaskStatus, TaskPriority, 
    CreateTaskInput, UpdateTaskInput, ReorderTasksInput
};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    /// Get a specific task by ID
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>> {
        let pool = ctx.data::<PgPool>()?;
        let task_id = Uuid::parse_str(&id.to_string())?;
        
        let task = task::get_task_by_id(pool, task_id).await?;
        Ok(task.map(|t| t.into()))
    }

    /// Get tasks with optional filters
    async fn tasks(
        &self, 
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<TaskStatus>,
        assignee_id: Option<ID>
    ) -> Result<Vec<Task>> {
        let pool = ctx.data::<PgPool>()?;
        
        let project_id = project_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
        
        // For now, we only support filtering by project_id without parent_task
        // Get tasks filtered by project_id
        let tasks = match project_id {
            Some(project_id) => task::list_project_tasks(pool, project_id, None).await?,
            None => Vec::new() // Return empty list when no project_id is specified
        };

        // TODO: Add support for status and assignee filtering in task queries module
        Ok(tasks.into_iter().map(|t| t.into()).collect())
    }
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        let pool = ctx.data::<PgPool>()?;
        let user_id = ctx.data::<Uuid>()?;
        
        // Convert input into model
        let task = TaskModel {
            task_id: Uuid::new_v4(),
            project_id: Uuid::parse_str(&input.project_id.to_string())?,
            parent_task_id: input.parent_task_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?,
            title: input.title,
            description: Some(input.description.unwrap_or_default()),
            assignee_id: None, // Will be set through task assignments
            status_id: input.status.to_string(),
            priority_order: input.priority_order.unwrap_or(0),
            start_date: input.start_date,
            due_date: input.due_date,
            actual_start_date: None,
            actual_end_date: None,
            effort: input.effort,
            progress: 0,
            created_by: *user_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        };

        // Create task
        let created = task::create_task(pool, task).await?;
        
        // Convert the first assignee_id (if any) to task's direct assignee
        if let Some(first_assignee) = input.assignee_ids.as_ref().and_then(|ids| ids.first()) {
            let assignee_id = Uuid::parse_str(&first_assignee.to_string())?;
            let mut task_with_assignee = created.clone();
            task_with_assignee.assignee_id = Some(assignee_id);
            task::update_task(pool, task_with_assignee).await?;
        }

        Ok(created.into())
    }

    async fn update_task(&self, ctx: &Context<'_>, id: ID, input: UpdateTaskInput) -> Result<Task> {
        let pool = ctx.data::<PgPool>()?;
        let task_id = Uuid::parse_str(&id.to_string())?;
        
        // Get existing task
        let mut task = task::get_task_by_id(pool, task_id)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Update fields based on input
        if let Some(title) = input.title {
            task.title = title;
        }
        if let Some(description) = input.description {
            task.description = Some(description);
        }
        if let Some(status) = input.status {
            task.status_id = status.to_string();
        }
        if let Some(priority_order) = input.priority_order {
            task.priority_order = priority_order;
        }
        if let Some(effort) = input.effort {
            if effort < 0.0 {
                return Err(Error::new("Effort cannot be negative"));
            }
            task.effort = Some(effort);
        }
        if let Some(start_date) = input.start_date {
            task.start_date = Some(start_date);
        }
        if let Some(due_date) = input.due_date {
            task.due_date = Some(due_date);
        }
        if let Some(actual_start) = input.actual_start_date {
            task.actual_start_date = Some(actual_start);
        }
        if let Some(actual_end) = input.actual_end_date {
            task.actual_end_date = Some(actual_end);
        }
        if let Some(progress) = input.progress {
            if progress < 0 || progress > 100 {
                return Err(Error::new("Progress must be between 0 and 100"));
            }
            task.progress = progress;
        }
        if let Some(assignee_ids) = input.assignee_ids {
            if let Some(first_assignee) = assignee_ids.first() {
                task.assignee_id = Some(Uuid::parse_str(&first_assignee.to_string())?);
            } else {
                task.assignee_id = None;
            }
        }
        task.updated_at = Utc::now();

        // Update task in database
        let updated = task::update_task(pool, task).await?;
        Ok(updated.into())
    }

    async fn delete_task(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let pool = ctx.data::<PgPool>()?;
        let task_id = Uuid::parse_str(&id.to_string())?;

        task::delete_task(pool, task_id).await?;
        Ok(true)
    }

    async fn reorder_tasks(&self, ctx: &Context<'_>, input: ReorderTasksInput) -> Result<Vec<Task>> {
        let pool = ctx.data::<PgPool>()?;
        let mut updated_tasks = Vec::new();
        
        // Update each task's priority_order individually since we don't have a batch update function
        for order in input.task_orders {
            let task_id = Uuid::parse_str(&order.task_id.to_string())?;
            if let Some(mut task) = task::get_task_by_id(pool, task_id).await? {
                task.priority_order = order.priority_order;
                let updated = task::update_task(pool, task).await?;
                updated_tasks.push(updated);
            }
        }
        
        Ok(updated_tasks.into_iter().map(|t| t.into()).collect())
    }
}
