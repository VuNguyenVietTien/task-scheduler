use async_graphql::{Context, Object, Result, ID};
use chrono::{DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;
use serde_json::{json, Value as JsonValue};

use crate::auth::error::AuthError;
use crate::graphql::context::Context as GraphQLContext;
use crate::graphql::types::{
    Task, Assignee, TaskStatus, TaskPriority, TaskProgressType,
    CreateTaskInput, UpdateTaskInput, ReorderTasksInput
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
            WITH RECURSIVE child_tasks AS (
                SELECT t.*, 
                    u.user_id as assignee_user_id,
                    u.username as assignee_username,
                    u.avatar_url as assignee_avatar_url,
                    u.role::text as assignee_role
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.user_id
                WHERE t.task_id = $1 AND NOT t.is_deleted
                
                UNION ALL
                
                SELECT t.*, 
                    u.user_id as assignee_user_id,
                    u.username as assignee_username,
                    u.avatar_url as assignee_avatar_url,
                    u.role::text as assignee_role
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.user_id
                INNER JOIN child_tasks ct ON t.parent_task_id = ct.task_id
                WHERE NOT t.is_deleted
            )
            SELECT * FROM child_tasks
            "#
        )
        .bind(task_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        if task.is_empty() {
            return Ok(None);
        }

        // Build task hierarchy
        let parent_task = &task[0];
        let child_tasks = task[1..].iter().map(|row| Task {
            task_id: row.get("task_id"),
            project_id: row.get("project_id"),
            parent_task_id: row.get("parent_task_id"),
            title: row.get("title"),
            description: row.get("description"),
            assignee: row.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: row.get("assignee_user_id"),
                username: row.get("assignee_username"),
                avatar_url: row.get("assignee_avatar_url"),
                role: row.get("assignee_role")
            }),
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
            is_deleted: row.get("is_deleted"),
            status: row.get("status"),
            priority: row.get("priority"),
            type_: row.get("type"),
            category: row.get("category"),
            progress_type: row.get::<Option<String>, _>("progress_type")
                .map(|s| s.into()),
            tags: row.get::<Option<JsonValue>, _>("tags"),
            child_tasks: None
        }).collect::<Vec<_>>();

        Ok(Some(Task {
            task_id: parent_task.get("task_id"),
            project_id: parent_task.get("project_id"),
            parent_task_id: parent_task.get("parent_task_id"),
            title: parent_task.get("title"),
            description: parent_task.get("description"),
            assignee: parent_task.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: parent_task.get("assignee_user_id"),
                username: parent_task.get("assignee_username"),
                avatar_url: parent_task.get("assignee_avatar_url"),
                role: parent_task.get("assignee_role")
            }),
            priority_order: parent_task.get("priority_order"),
            start_date: parent_task.get("start_date"),
            due_date: parent_task.get("due_date"),
            actual_start_date: parent_task.get("actual_start_date"),
            actual_end_date: parent_task.get("actual_end_date"),
            effort: parent_task.get("effort"),
            progress: parent_task.get("progress"),
            created_by: parent_task.get("created_by"),
            created_at: parent_task.get("created_at"),
            updated_at: parent_task.get("updated_at"),
            is_deleted: parent_task.get("is_deleted"),
            status: parent_task.get::<String, _>("status").into(),
            priority: parent_task.get::<String, _>("priority").into(),
            type_: parent_task.get("type"),
            category: parent_task.get("category"),
            progress_type: parent_task.get::<Option<String>, _>("progress_type")
                .map(|s| s.into()),
            tags: parent_task.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(child_tasks)
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
            WITH RECURSIVE task_tree AS (
                SELECT t.*, 
                    u.user_id as assignee_user_id,
                    u.username as assignee_username,
                    u.avatar_url as assignee_avatar_url,
                    u.role::text as assignee_role
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.user_id
                WHERE NOT t.is_deleted
                AND t.parent_task_id IS NULL
                AND ($1::uuid IS NULL OR t.project_id = $1)
                AND ($2::text IS NULL OR t.status::text = $2)
                AND ($3::uuid IS NULL OR t.assignee_id = $3)
                
                UNION ALL
                
                SELECT t.*, 
                    u.user_id as assignee_user_id,
                    u.username as assignee_username,
                    u.avatar_url as assignee_avatar_url,
                    u.role::text as assignee_role
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.user_id
                INNER JOIN task_tree tt ON t.parent_task_id = tt.task_id
                WHERE NOT t.is_deleted
            )
            SELECT * FROM task_tree
            ORDER BY created_at DESC
            "#
        )
        .bind(project_id)
        .bind(status)
        .bind(assignee_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        // Build task tree
        let mut task_map = std::collections::HashMap::new();
        let mut root_tasks = Vec::new();

        // First pass: create all tasks
        for row in &tasks {
            let task = Task {
                task_id: row.get("task_id"),
                project_id: row.get("project_id"),
                parent_task_id: row.get("parent_task_id"),
                title: row.get("title"),
                description: row.get("description"),
                assignee: row.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                    user_id: row.get("assignee_user_id"),
                    username: row.get("assignee_username"),
                    avatar_url: row.get("assignee_avatar_url"),
                    role: row.get("assignee_role")
                }),
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
                is_deleted: row.get("is_deleted"),
                status: row.get("status"),
                priority: row.get("priority"),
                type_: row.get("type"),
                category: row.get("category"),
                progress_type: row.get("progress_type"),
                tags: row.get::<Option<JsonValue>, _>("tags"),
                child_tasks: Some(Vec::new())
            };

            let task_id: Uuid = row.get("task_id");
            if row.get::<Option<Uuid>, _>("parent_task_id").is_none() {
                root_tasks.push(task_id);
            }
            task_map.insert(task_id, task);
        }

        // Second pass: build tree structure
        for row in &tasks {
            if let Some(parent_id) = row.get::<Option<Uuid>, _>("parent_task_id") {
                let task_id: Uuid = row.get("task_id");
                if let Some(task) = task_map.get(&task_id).cloned() {
                    if let Some(parent_task) = task_map.get_mut(&parent_id) {
                        if let Some(children) = &mut parent_task.child_tasks {
                            children.push(task);
                        }
                    }
                }
            }
        }

        // Return only root tasks
        Ok(root_tasks.into_iter()
            .filter_map(|id| task_map.get(&id))
            .cloned()
            .collect())
    }

    async fn task_subtasks(&self, ctx: &Context<'_>, task_id: ID) -> Result<Vec<Task>> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&task_id.to_string())?;
        
        // Truy vấn để lấy tất cả các task con
        let subtasks = sqlx::query(
            r#"
            SELECT t.*, 
                u.user_id as assignee_user_id,
                u.username as assignee_username,
                u.avatar_url as assignee_avatar_url,
                u.role::text as assignee_role,
                c.user_id as creator_user_id,
                c.username as creator_username,
                c.avatar_url as creator_avatar_url,
                c.role::text as creator_role
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.user_id
            LEFT JOIN users c ON t.created_by = c.user_id
            WHERE t.parent_task_id = $1 AND NOT t.is_deleted
            ORDER BY t.priority_order, t.created_at
            "#
        )
        .bind(task_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AuthError::Database(e))?;

        let mut result = Vec::new();
        
        // Chuyển đổi kết quả thành danh sách Task
        for row in subtasks {
            let assignee = row.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: row.get("assignee_user_id"),
                username: row.get("assignee_username"),
                avatar_url: row.get("assignee_avatar_url"),
                role: row.get("assignee_role")
            });
            
            let creator = row.get::<Option<Uuid>, _>("creator_user_id").map(|_| Assignee {
                user_id: row.get("creator_user_id"),
                username: row.get("creator_username"),
                avatar_url: row.get("creator_avatar_url"),
                role: row.get("creator_role")
            });

            let task = Task {
                task_id: row.get("task_id"),
                project_id: row.get("project_id"),
                parent_task_id: row.get("parent_task_id"),
                title: row.get("title"),
                description: row.get("description"),
                assignee,
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
                is_deleted: row.get("is_deleted"),
                status: row.get("status"),
                priority: row.get("priority"),
                type_: row.get("type"),
                category: row.get("category"),
                progress_type: row.get("progress_type"),
                tags: row.get::<Option<JsonValue>, _>("tags"),
                child_tasks: None,
                creator
            };
            
            result.push(task);
        }
        
        Ok(result)
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

        let tags_json = input.tags.as_ref().map(|tags| json!(tags));
        let task_id = Uuid::new_v4();
        let now = Utc::now();
        let project_id = Uuid::parse_str(&input.project_id.to_string())?;
        let parent_task_id = input.parent_task_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?;
        let assignee_id = input.assignee_id
            .map(|id| Uuid::parse_str(&id.to_string()))
            .transpose()?;

        let created = sqlx::query(
            r#"
            WITH inserted_task AS (
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
            )
            SELECT t.*, 
                   u.user_id as assignee_user_id,
                   u.username as assignee_username,
                   u.avatar_url as assignee_avatar_url,
                   u.role::text as assignee_role
            FROM inserted_task t
            LEFT JOIN users u ON t.assignee_id = u.user_id
            "#
        )
        .bind(task_id)
        .bind(project_id)
        .bind(parent_task_id)
        .bind(&input.title)
        .bind(input.description.as_ref())
        .bind(input.status)
        .bind(input.priority)
        .bind(input.priority_order)
        .bind(input.start_date)
        .bind(input.due_date)
        .bind(input.effort)
        .bind(0f64) // Initial progress
        .bind(Uuid::parse_str(&user_id)?)
        .bind(now)
        .bind(now)
        .bind(false)
        .bind(assignee_id)
        .bind(None::<DateTime<Utc>>) // actual_start_date
        .bind(None::<DateTime<Utc>>) // actual_end_date
        .bind(input.type_)
        .bind(input.category)
        .bind(input.progress_type)
        .bind(tags_json)
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
            assignee: created.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: created.get("assignee_user_id"),
                username: created.get("assignee_username"),
                avatar_url: created.get("assignee_avatar_url"),
                role: created.get("assignee_role")
            }),
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
            is_deleted: created.get("is_deleted"),
            status: created.get::<String, _>("status").into(),
            priority: created.get::<String, _>("priority").into(),
            type_: created.get("type"),
            category: created.get("category"),
            progress_type: created.get::<Option<String>, _>("progress_type")
                .map(|s| s.into()),
            tags: created.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(Vec::new())
        })
    }

    async fn update_task(&self, ctx: &Context<'_>, input: UpdateTaskInput) -> Result<Task> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&input.task_id.to_string())?;
        
        let mut tx = pool.begin().await.map_err(|e| AuthError::Database(e))?;

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

        let tags_json = input.tags.as_ref().map(|tags| json!(tags));
        let now = Utc::now();

        let updated = sqlx::query(
            r#"
            WITH updated_task AS (
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
                    type = COALESCE($13, type),
                    category = COALESCE($14, category),
                    progress_type = COALESCE($15, progress_type),
                    tags = COALESCE($16, tags),
                    is_deleted = COALESCE($17, is_deleted),
                    updated_at = $18
                WHERE task_id = $19
                RETURNING *
            )
            SELECT t.*, 
                   u.user_id as assignee_user_id,
                   u.username as assignee_username,
                   u.avatar_url as assignee_avatar_url,
                   u.role::text as assignee_role
            FROM updated_task t
            LEFT JOIN users u ON t.assignee_id = u.user_id
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
        .bind(input.effort)
        .bind(input.progress)
        .bind(input.assignee_id.map(|id| Uuid::parse_str(&id.to_string())).transpose()?)
        .bind(input.type_)
        .bind(input.category)
        .bind(input.progress_type)
        .bind(tags_json)
        .bind(input.is_deleted)
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
            assignee: updated.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                user_id: updated.get("assignee_user_id"),
                username: updated.get("assignee_username"),
                avatar_url: updated.get("assignee_avatar_url"),
                role: updated.get("assignee_role")
            }),
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
            is_deleted: updated.get("is_deleted"),
            status: updated.get::<String, _>("status").into(),
            priority: updated.get::<String, _>("priority").into(),
            type_: updated.get("type"),
            category: updated.get("category"),
            progress_type: updated.get::<Option<String>, _>("progress_type")
                .map(|s| s.into()),
            tags: updated.get::<Option<JsonValue>, _>("tags"),
            child_tasks: Some(Vec::new())
        })
    }

    async fn delete_task(&self, ctx: &Context<'_>, task_id: ID) -> Result<bool> {
        let context = ctx.data::<GraphQLContext>()?;
        let pool = &context.db;
        let task_id = Uuid::parse_str(&task_id.to_string())?;

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
            
            let updated = sqlx::query(
                r#"
                WITH reordered_task AS (
                    UPDATE tasks
                    SET 
                        priority_order = $1,
                        updated_at = $2
                    WHERE task_id = $3
                    RETURNING *
                )
                SELECT t.*, 
                       u.user_id as assignee_user_id,
                       u.username as assignee_username,
                       u.avatar_url as assignee_avatar_url,
                       u.role::text as assignee_role
                FROM reordered_task t
                LEFT JOIN users u ON t.assignee_id = u.user_id
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
                assignee: updated.get::<Option<Uuid>, _>("assignee_user_id").map(|_| Assignee {
                    user_id: updated.get("assignee_user_id"),
                    username: updated.get("assignee_username"),
                    avatar_url: updated.get("assignee_avatar_url"),
                    role: updated.get("assignee_role")
                }),
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
                is_deleted: updated.get("is_deleted"),
                status: updated.get::<String, _>("status").into(),
                priority: updated.get::<String, _>("priority").into(),
                type_: updated.get("type"),
                category: updated.get("category"),
                progress_type: updated.get::<Option<String>, _>("progress_type")
                    .map(|s| s.into()),
                tags: updated.get::<Option<JsonValue>, _>("tags"),
                child_tasks: Some(Vec::new())
            });
        }

        tx.commit().await.map_err(|e| AuthError::Database(e))?;
        
        Ok(updated_tasks)
    }
}
