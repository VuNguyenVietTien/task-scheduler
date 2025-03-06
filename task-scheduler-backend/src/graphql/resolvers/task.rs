use async_graphql::{Context, Object, Result, ID};
use chrono::{DateTime, Utc};
use sqlx::{Row, postgres::PgRow};
use uuid::Uuid;
use serde_json::json;

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    Task, TaskStatus, CreateTaskInput, UpdateTaskInput, ReorderTasksInput
};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&id.to_string())?;
        
        let task = sqlx::query(
            r#"
            SELECT 
                t.*,
                COALESCE(json_agg(
                    DISTINCT jsonb_build_object(
                        'id', ta.assignment_id,
                        'user_id', ta.user_id,
                        'task_id', ta.task_id,
                        'assigned_at', ta.assigned_at
                    )
                ) FILTER (WHERE ta.assignment_id IS NOT NULL), '[]') as assignees
            FROM tasks t
            LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
            WHERE t.task_id = $1 AND NOT t.is_deleted
            GROUP BY t.task_id
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
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            is_deleted: row.get("is_deleted")
        }))
    }

    async fn tasks(
        &self, 
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<TaskStatus>,
        assignee_id: Option<ID>
    ) -> Result<Vec<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        
        let project_id = project_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
        let assignee_id = assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?;
        
        let tasks = sqlx::query(
            r#"
            SELECT 
                t.*,
                COALESCE(json_agg(
                    DISTINCT jsonb_build_object(
                        'id', ta.assignment_id,
                        'user_id', ta.user_id,
                        'task_id', ta.task_id,
                        'assigned_at', ta.assigned_at
                    )
                ) FILTER (WHERE ta.assignment_id IS NOT NULL), '[]') as assignees
            FROM tasks t
            LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
            WHERE NOT t.is_deleted
            AND ($1::uuid IS NULL OR t.project_id = $1)
            AND ($2::text IS NULL OR t.status::text = $2)
            AND ($3::uuid IS NULL OR t.assignee_id = $3)
            GROUP BY t.task_id
            ORDER BY t.priority_order ASC
            "#
        )
        .bind(project_id)
        .bind(status.map(|s| s.to_string()))
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
            start_date: row.get("start_date"),
            due_date: row.get("due_date"),
            actual_start_date: row.get("actual_start_date"),
            actual_end_date: row.get("actual_end_date"),
            effort: row.get("effort"),
            progress: row.get("progress"),
            created_by: row.get("created_by"),
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
                title, description, status,
                priority_order, start_date, due_date,
                effort, progress, created_by,
                created_at, updated_at, is_deleted,
                assignee_id, actual_start_date, actual_end_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
            "#
        )
        .bind(task_id)
        .bind(project_id)
        .bind(parent_task_id)
        .bind(&input.title)
        .bind(input.description.as_ref())
        .bind(input.status)
        .bind(input.priority_order.unwrap_or(0))
        .bind(input.start_date)
        .bind(input.due_date)
        .bind(input.effort)
        .bind(0) // Initial progress
        .bind(Uuid::parse_str(&user_id)?)
        .bind(now)
        .bind(now)
        .bind(false)
        .bind(None::<Uuid>) // assignee_id
        .bind(None::<DateTime<Utc>>) // actual_start_date
        .bind(None::<DateTime<Utc>>) // actual_end_date
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Add assignees if provided
        // let assignees = if let Some(assignee_ids) = input.assignee_ids {
        //     let mut assignees = Vec::new();
        //     for assignee_id in assignee_ids {
        //         let assignment_id = Uuid::new_v4();
        //         sqlx::query(
        //             r#"
        //             INSERT INTO task_assignments (
        //                 assignment_id, task_id, user_id, assigned_at
        //             )
        //             VALUES ($1, $2, $3, $4)
        //             RETURNING *
        //             "#
        //         )
        //         .bind(assignment_id)
        //         .bind(task_id)
        //         .bind(Uuid::parse_str(&assignee_id.to_string())?)
        //         .bind(now)
        //         .execute(&mut *tx)
        //         .await
        //         .map_err(|e| AuthError::Database(e))?;

        //         assignees.push(json!({
        //             "id": assignment_id,
        //             "task_id": task_id,
        //             "user_id": assignee_id.to_string(),
        //             "assigned_at": now
        //         }));
        //     }
        //     json!(assignees)
        // } else {
        //     json!([])
        // };

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
            start_date: created.get("start_date"),
            due_date: created.get("due_date"),
            actual_start_date: created.get("actual_start_date"),
            actual_end_date: created.get("actual_end_date"), 
            effort: created.get("effort"),
            progress: created.get("progress"),
            created_by: created.get("created_by"),
            created_at: created.get("created_at"),
            updated_at: created.get("updated_at"),
            is_deleted: created.get("is_deleted")
        })
    }

    async fn update_task(&self, ctx: &Context<'_>, id: ID, input: UpdateTaskInput) -> Result<Task> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&id.to_string())?;
        
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
                start_date = COALESCE($5, start_date),
                due_date = COALESCE($6, due_date),
                actual_start_date = COALESCE($7, actual_start_date),
                actual_end_date = COALESCE($8, actual_end_date),
                effort = COALESCE($9, effort),
                progress = COALESCE($10, progress),
                assignee_id = $11,
                updated_at = $12
            WHERE task_id = $13
            RETURNING *
            "#
        )
        .bind(input.title)
        .bind(input.description)
        .bind(input.status.map(|s| s.to_string()))
        .bind(input.priority_order)
        .bind(input.start_date)
        .bind(input.due_date)
        .bind(input.actual_start_date)
        .bind(input.actual_end_date)
        .bind(input.effort)
        .bind(input.progress)
        .bind(input.assignee_ids.as_ref().and_then(|ids| ids.first()).map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
        .bind(now)
        .bind(task_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Update assignees if provided  
        let assignees = if let Some(assignee_ids) = input.assignee_ids {
            let mut assignees = Vec::new();
            
            // Delete existing assignments
            sqlx::query("DELETE FROM task_assignments WHERE task_id = $1")
                .bind(task_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| AuthError::Database(e))?;

            // Add new assignments
            for assignee_id in assignee_ids {
                let assignment_id = Uuid::new_v4();
                let assignment = sqlx::query(
                    r#"
                    INSERT INTO task_assignments (
                        assignment_id, task_id, user_id, assigned_at
                    )
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                    "#
                )
                .bind(assignment_id)
                .bind(task_id)
                .bind(Uuid::parse_str(&assignee_id.to_string())?)
                .bind(now)
                .execute(&mut *tx)
                .await
                .map_err(|e| AuthError::Database(e))?;

                assignees.push(json!({
                    "id": assignment_id,
                    "task_id": task_id,
                    "user_id": assignee_id.to_string(),
                    "assigned_at": now
                }));
            }
            json!(assignees)
        } else {
            json!([])
        };

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
            start_date: updated.get("start_date"),
            due_date: updated.get("due_date"),
            actual_start_date: updated.get("actual_start_date"),
            actual_end_date: updated.get("actual_end_date"),
            effort: updated.get("effort"),
            progress: updated.get("progress"),
            created_by: updated.get("created_by"),
            created_at: updated.get("created_at"),
            updated_at: updated.get("updated_at"),
            is_deleted: updated.get("is_deleted")
        })
    }

    async fn delete_task(&self, ctx: &Context<'_>, id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&id.to_string())?;

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

            // Get assignees
            let assignees = sqlx::query(
                r#"
                SELECT json_agg(
                    jsonb_build_object(
                        'id', assignment_id,
                        'user_id', user_id,
                        'task_id', task_id,
                        'assigned_at', assigned_at
                    )
                ) as assignees
                FROM task_assignments
                WHERE task_id = $1
                GROUP BY task_id
                "#
            )
            .bind(task_id)
            .fetch_optional(&mut *tx)
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
                start_date: updated.get("start_date"),
                due_date: updated.get("due_date"),
                actual_start_date: updated.get("actual_start_date"),
                actual_end_date: updated.get("actual_end_date"),
                effort: updated.get("effort"),
                progress: updated.get("progress"),
                created_by: updated.get("created_by"),
                created_at: updated.get("created_at"),
                updated_at: updated.get("updated_at"),
                is_deleted: updated.get("is_deleted")
            });
        }

        tx.commit().await.map_err(|e| AuthError::Database(e))?;
        
        Ok(updated_tasks)
    }
}
