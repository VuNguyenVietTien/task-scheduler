use async_graphql::{Context, Error, Object, Result};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::get_current_user;
use crate::db::enums::{TaskPriority, TaskProgressType, TaskStatus};
use crate::db::models::Task;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub project_id: Uuid,
    pub parent_task_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub effort: Option<f64>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub deadline: Option<chrono::DateTime<chrono::Utc>>,
    pub assignee_id: Option<Uuid>,
    pub priority_order: Option<i32>,
    pub type_: Option<String>,
    pub category: Option<String>,
    pub progress_type: Option<TaskProgressType>,
    pub tags: Option<Vec<String>>,
}

pub struct TaskMutation;

#[Object]
impl TaskMutation {
    pub async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        let pool = ctx.data::<PgPool>()?;
        let current_user = get_current_user(ctx)?;

        // Insert task with new fields
        let task = sqlx::query_as!(
            Task,
            r#"
            INSERT INTO tasks (
                project_id,
                parent_task_id,
                title,
                description,
                status,
                priority,
                effort,
                start_date,
                deadline,
                assignee_id,
                priority_order,
                type,
                category,
                progress_type,
                tags,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
            "#,
            input.project_id,
            input.parent_task_id,
            input.title,
            input.description,
            input.status as TaskStatus,
            input.priority as TaskPriority,
            input.effort,
            input.start_date,
            input.deadline,
            input.assignee_id,
            input.priority_order.unwrap_or(0),
            input.type_,
            input.category,
            input.progress_type as Option<TaskProgressType>,
            input.tags.map(|t| serde_json::to_value(t).unwrap()),
            current_user.user_id
        )
        .fetch_one(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to create task: {}", e)))?;

        Ok(task)
    }
}

pub struct TaskQuery;

#[Object]
impl TaskQuery {
    pub async fn task(&self, ctx: &Context<'_>, task_id: Uuid) -> Result<Option<Task>> {
        let pool = ctx.data::<PgPool>()?;
        
        let task = sqlx::query_as!(
            Task,
            r#"
            SELECT * FROM tasks 
            WHERE task_id = $1 AND is_deleted = false
            "#,
            task_id
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to fetch task: {}", e)))?;

        Ok(task)
    }

    pub async fn tasks(
        &self,
        ctx: &Context<'_>,
        project_id: Option<Uuid>,
        status: Option<TaskStatus>,
        assignee_id: Option<Uuid>,
    ) -> Result<Vec<Task>> {
        let pool = ctx.data::<PgPool>()?;
        
        let tasks = sqlx::query_as!(
            Task,
            r#"
            SELECT * FROM tasks 
            WHERE ($1::uuid IS NULL OR project_id = $1)
            AND ($2::task_status IS NULL OR status = $2)
            AND ($3::uuid IS NULL OR assignee_id = $3)
            AND is_deleted = false
            ORDER BY priority_order ASC
            "#,
            project_id,
            status as Option<TaskStatus>,
            assignee_id
        )
        .fetch_all(pool)
        .await
        .map_err(|e| Error::new(format!("Failed to fetch tasks: {}", e)))?;

        Ok(tasks)
    }
}