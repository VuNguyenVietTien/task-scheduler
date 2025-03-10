use async_graphql::{Context, Object, Result, ID, Enum};
use chrono::{DateTime, Utc};
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;
use serde_json::{json, Value}; // Add Value import
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use crate::db::enums::TaskProgressType;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput, ReorderTasksInput
};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, task_id: ID) -> Result<Option<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&task_id.to_string())?;
        
        let task = sqlx::query(
            r#"
            SELECT t.*
            FROM tasks t
            WHERE t.task_id = $1 AND NOT t.is_deleted
            "#
        )
        .bind(task_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(task.map(|row| Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            parent_task_id: row.get("parent_task_id"),
            title: row.get("title"),
            description: row.get("description"),
            assignee_id: row.get("assignee_id"),
            status: row.get("status"),
            priority_order: row.get("priority_order"),
            priority: row.get("priority"),
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            type_: row.get("type"),
            category: row.get("category"),
            progress_type: row.get("progress_type"),
            tags: row.get("tags"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted")
        }))
    }

    async fn tasks(
        &self, 
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<String>,
        assignee_id: Option<ID>
    ) -> Result<Vec<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        
        let project_id = project_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
        let assignee_id = assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
        
        let tasks = sqlx::query(
            r#"
            SELECT t.*
            FROM tasks t
            WHERE NOT t.is_deleted
            AND ($1::uuid IS NULL OR t.project_id = $1)
            AND ($2::text IS NULL OR t.status::text = $2)
            AND ($3::uuid IS NULL OR t.assignee_id = $3)
            ORDER BY t.priority_order ASC
            "#
        )
        .bind(project_id)
        .bind(status)
        .bind(assignee_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(tasks.into_iter().map(|row| Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            parent_task_id: row.get("parent_task_id"),
            title: row.get("title"),
            description: row.get("description"), 
            assignee_id: row.get("assignee_id"),
            status: row.get("status"),
            priority_order: row.get("priority_order"),
            priority: row.get("priority"),
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            type_: row.get("type"),
            category: row.get("category"),
            progress_type: row.get("progress_type"),
            tags: row.get("tags"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted")
        }).collect())
    }
}

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let auth = context.auth.as_ref().ok_or_else(|| AuthError::InvalidCredentials)?;
        let user_id = auth.sub.clone();

        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Convert effort from f64 to Decimal
        let effort = input.effort.map(|e| Decimal::from_f64(e).unwrap_or_else(|| Decimal::new(0, 0)));

        // Convert tags to JSON
        let tags_json = match input.tags {
            Some(tags) => serde_json::to_value(tags)?,
            None => json!([])
        };

        // Create task
        let task_id = Uuid::new_v4();
        let now = Utc::now();
        let project_id = Uuid::parse_str(&input.project_id.to_string())?;
        let parent_task_id = input.parent_task_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?;

        let created = sqlx::query(
            r#"
            INSERT INTO tasks (
                task_id, project_id, parent_task_id,
                title, description, status, priority,
                priority_order, start_date, due_date,
                effort, progress, created_by,
                created_at, updated_at, is_deleted,
                assignee_id, actual_start_date, actual_end_date,
                type, category, progress_type, tags
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
            "#
        )
        .bind(task_id)
        .bind(project_id)
        .bind(parent_task_id)
        .bind(&input.title)
        .bind(input.description.as_ref())
        .bind(input.status)
        .bind(input.priority)
        .bind(input.priority_order.unwrap_or(0))
        .bind(input.start_date)
        .bind(input.due_date)
        .bind(effort)
        .bind(0) // Initial progress
        .bind(Uuid::parse_str(&user_id)?)
        .bind(now)
        .bind(now)
        .bind(false)
        .bind(input.assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
        .bind(None::<DateTime<Utc>>) // actual_start_date
        .bind(None::<DateTime<Utc>>) // actual_end_date
        .bind(input.type_)
        .bind(input.category)
        .bind(input.progress_type)
        .bind(tags_json) // Use converted tags_json
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        tx.commit().await.map_err(|e| AuthError::Database(e))?;

        Ok(Task {
            task_id: created.get("task_id"),
            project_id: created.get("project_id"),
            parent_task_id: created.get("parent_task_id"),
            title: created.get("title"),
            description: created.get("description"),
            assignee_id: created.get("assignee_id"),
            status: created.get("status"),
            priority_order: created.get("priority_order"),
            priority: created.get("priority"),
            start_date: created.get("start_date"),
            due_date: created.get("due_date"),
            actual_start_date: created.get("actual_start_date"),
            actual_end_date: created.get("actual_end_date"),
            effort: created.get::<Option<f64>, _>("effort"),
            progress: created.get("progress"),
            created_by: created.get("created_by"),
            type_: created.get("type"),
            category: created.get("category"),
            progress_type: created.get("progress_type"),
            tags: created.get::<Option<Value>, _>("tags").and_then(|v| v.as_array().map(|arr| arr.iter().filter_map(|val| val.as_str().map(String::from)).collect())),
            created_at: created.get("created_at"),
            updated_at: created.get("updated_at"),
            is_deleted: created.get("is_deleted")
        })
    }

    async fn update_task(&self, ctx: &Context<'_>, input: UpdateTaskInput) -> Result<Task> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&input.task_id.to_string())?;
        
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

        // Check if task exists
        let existing = sqlx::query(
            r#"
            SELECT *
            FROM tasks
            WHERE task_id = $1 AND NOT is_deleted
            "#
        )
        .bind(task_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        if existing.is_none() {
            return Err(AuthError::Other("Task not found".to_string()).into());
        }

        // Convert effort from f64 to Decimal
        let effort = input.effort.map(|e| Decimal::from_f64(e).unwrap_or_else(|| Decimal::new(0, 0)));

        // Update task
        let now = Utc::now();
        let updated = sqlx::query(
            r#"
            UPDATE tasks 
            SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority_order = COALESCE($4, priority_order),
                priority = COALESCE($5, priority),
                start_date = COALESCE($6, start_date),
                due_date = COALESCE($7, due_date),
                actual_start_date = COALESCE($8, actual_start_date),
                actual_end_date = COALESCE($9, actual_end_date),
                effort = COALESCE($10, effort),
                progress = COALESCE($11, progress),
                assignee_id = $12,
                updated_at = $13
            WHERE task_id = $14
            RETURNING *
            "#
        )
        .bind(input.title)
        .bind(input.description)
        .bind(input.status)
        .bind(input.priority_order)
        .bind(input.priority)
        .bind(input.start_date)
        .bind(input.due_date)
        .bind(input.actual_start_date)
        .bind(input.actual_end_date)
        .bind(effort)
        .bind(input.progress)
        .bind(input.assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
        .bind(now)
        .bind(task_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        tx.commit().await.map_err(|e| AuthError::Database(e))?;

        Ok(Task {
            task_id: updated.get("task_id"),
            project_id: updated.get("project_id"),
            parent_task_id: updated.get("parent_task_id"),
            title: updated.get("title"),
            description: updated.get("description"),
            assignee_id: updated.get("assignee_id"),
            status: updated.get("status"),
            priority_order: updated.get("priority_order"),
            priority: updated.get("priority"),
            start_date: updated.get("start_date"),
            due_date: updated.get("due_date"),
            actual_start_date: updated.get("actual_start_date"),
            actual_end_date: updated.get("actual_end_date"),
            effort: updated.get("effort"),
            progress: updated.get("progress"),
            created_by: updated.get("created_by"),
            type_: updated.get("type"),
            category: updated.get("category"),
            progress_type: updated.get("progress_type"),
            tags: updated.get("tags"),
            created_at: updated.get("created_at"),
            updated_at: updated.get("updated_at"),
            is_deleted: updated.get("is_deleted")
        })
    }

    async fn delete_task(&self, ctx: &Context<'_>, task_id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&task_id.to_string())?;

        // Soft delete
        sqlx::query(
            r#"
            UPDATE tasks 
            SET is_deleted = true 
            WHERE task_id = $1
            "#
        )
        .bind(task_id)
        .execute(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        Ok(true)
    }

    async fn reorder_tasks(&self, ctx: &Context<'_>, input: ReorderTasksInput) -> Result<Vec<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;
        let mut updated_tasks = Vec::new();
        
        for order in input.task_orders {
            let task_id = Uuid::parse_str(&order.task_id.to_string())?;
            
            // Update task priority
            let updated = sqlx::query(
                r#"
                UPDATE tasks
                SET 
                    priority_order = $1,
                    updated_at = $2
                WHERE task_id = $3
                RETURNING *
                "#
            )
            .bind(order.priority_order)
            .bind(Utc::now())
            .bind(task_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| AuthError::Database(e))?;

            updated_tasks.push(Task {
                task_id: updated.get("task_id"),
                project_id: updated.get("project_id"),
                parent_task_id: updated.get("parent_task_id"),
                title: updated.get("title"),
                description: updated.get("description"),
                assignee_id: updated.get("assignee_id"),
                status: updated.get("status"),
                priority_order: updated.get("priority_order"),
                priority: updated.get("priority"),
                start_date: updated.get("start_date"),
                due_date: updated.get("due_date"),
                actual_start_date: updated.get("actual_start_date"),
                actual_end_date: updated.get("actual_end_date"),
                effort: updated.get("effort"),
                progress: updated.get("progress"),
                created_by: updated.get("created_by"),
                type_: updated.get("type"),
                category: updated.get("category"),
                progress_type: updated.get("progress_type"),
                tags: updated.get("tags"),
                created_at: updated.get("created_at"),
                updated_at: updated.get("updated_at"),
                is_deleted: updated.get("is_deleted")
            });
        }

        tx.commit().await.map_err(|e| AuthError::Database(e))?;
        
        Ok(updated_tasks)
    }
}
