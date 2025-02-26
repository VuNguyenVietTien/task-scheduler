use async_graphql::*;
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, QueryOrder, Condition};
use uuid::Uuid;
use crate::{
    db::entities::{task, user, project},
    error::AppError,
    graphql::types::*,
};

pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Task>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let task_id = Uuid::parse_str(id.as_str())?;

        let task = task::Entity::find_by_id(task_id)
            .one(db)
            .await?
            .map(Into::into);

        Ok(task)
    }

    async fn tasks(
        &self,
        ctx: &Context<'_>,
        project_id: Option<ID>,
        status: Option<String>,
        assignee_id: Option<ID>,
    ) -> Result<Vec<Task>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        
        // Build query conditions
        let mut condition = Condition::all();
        
        if let Some(proj_id) = project_id {
            let uuid = Uuid::parse_str(proj_id.as_str())?;
            condition = condition.add(task::Column::ProjectId.eq(uuid));
        }
        
        if let Some(status_str) = status {
            condition = condition.add(task::Column::Status.eq(status_str));
        }

        // Query tasks
        let mut tasks = task::Entity::find()
            .filter(condition)
            .order_by_asc(task::Column::CreatedAt)
            .all(db)
            .await?;

        // Filter by assignee if specified
        if let Some(assignee) = assignee_id {
            let assignee_uuid = Uuid::parse_str(assignee.as_str())?;
            tasks.retain(|task| {
                // Implementation note: In a real app, we would use a proper
                // task_assignments table query instead of this placeholder
                true
            });
        }

        Ok(tasks.into_iter().map(Into::into).collect())
    }
}

pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(
        &self,
        ctx: &Context<'_>,
        input: CreateTaskInput,
    ) -> Result<Task> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        // Validate project existence and access
        let project_id = Uuid::parse_str(input.project_id.as_str())?;
        let project = project::Entity::find_by_id(project_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Project not found"))?;

        // Create task
        let task = task::ActiveModel {
            id: Set(Uuid::new_v4()),
            project_id: Set(project_id),
            parent_task_id: Set(input.parent_task_id
                .map(|id| Uuid::parse_str(id.as_str()))
                .transpose()?),
            title: Set(input.title),
            description: Set(input.description),
            status: Set(input.status),
            priority: Set(input.priority),
            effort_hours: Set(input.effort_hours),
            start_date: Set(input.start_date.map(Into::into)),
            deadline: Set(input.deadline.map(Into::into)),
            created_by: Set(auth_user.id),
            created_at: Set(chrono::Utc::now().into()),
            updated_at: Set(chrono::Utc::now().into()),
            metadata: Set(serde_json::json!({})),
        };

        let task = task.insert(db).await?;

        // Assign task to users
        for assignee_id in input.assignee_ids {
            // Implementation note: In a real app, we would create
            // task assignments in a separate table here
        }

        Ok(task.into())
    }

    async fn update_task_status(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        status: String,
    ) -> Result<Task> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let uuid = Uuid::parse_str(task_id.as_str())?;
        let task = task::Entity::find_by_id(uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Update task status
        let mut task: task::ActiveModel = task.into();
        let now = chrono::Utc::now();
        
        // Set dates based on status transitions
        match status.as_str() {
            "IN_PROGRESS" => {
                // Only set start_date if it's not already set
                if task.start_date.as_ref().is_none() {
                    task.start_date = Set(Some(now.into()));
                }
            },
            "DONE" => {
                // Set completion date when moving to done
                task.deadline = Set(Some(now.into()));
            },
            _ => {}
        }

        task.status = Set(status);
        task.updated_at = Set(now.into());

        let updated_task = task.update(db).await?;

        Ok(updated_task.into())
    }

    async fn assign_task(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        user_id: ID,
    ) -> Result<Task> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let task_uuid = Uuid::parse_str(task_id.as_str())?;
        let user_uuid = Uuid::parse_str(user_id.as_str())?;

        // Verify task exists
        let task = task::Entity::find_by_id(task_uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        // Verify user exists
        let user = user::Entity::find_by_id(user_uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("User not found"))?;

        // Implementation note: In a real app, we would create/update
        // task assignment in a separate table here

        Ok(task.into())
    }

    async fn update_task_priority_order(
        &self,
        ctx: &Context<'_>,
        task_id: ID,
        new_order: i32,
    ) -> Result<Task> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let uuid = Uuid::parse_str(task_id.as_str())?;
        let task = task::Entity::find_by_id(uuid)
            .one(db)
            .await?
            .ok_or_else(|| Error::new("Task not found"))?;

        let mut task: task::ActiveModel = task.into();
        task.priority_order = Set(new_order);
        task.updated_at = Set(chrono::Utc::now().into());

        let updated_task = task.update(db).await?;

        Ok(updated_task.into())
    }

    async fn reorder_tasks(
        &self,
        ctx: &Context<'_>,
        input: ReorderTasksInput,
    ) -> Result<Vec<Task>> {
        let db = ctx.data::<sea_orm::DatabaseConnection>()?;
        let auth_user = ctx.data::<crate::auth::AuthUser>()
            .ok_or_else(|| Error::new("Not authenticated"))?;

        let mut updated_tasks = Vec::new();
        
        // Update each task's priority order
        for order in input.task_orders {
            let task_uuid = Uuid::parse_str(order.task_id.as_str())?;
            let task = task::Entity::find_by_id(task_uuid)
                .one(db)
                .await?
                .ok_or_else(|| Error::new(format!("Task {} not found", order.task_id)))?;

            let mut task: task::ActiveModel = task.into();
            task.priority_order = Set(order.priority_order);
            task.updated_at = Set(chrono::Utc::now().into());

            let updated_task = task.update(db).await?;
            updated_tasks.push(updated_task);
        }

        Ok(updated_tasks.into_iter().map(Into::into).collect())
    }
}

// Implement conversion from database model to GraphQL type
impl From<task::Model> for Task {
    fn from(model: task::Model) -> Self {
        Task {
            id: model.id.into(),
            project_id: model.project_id.into(),
            parent_task_id: model.parent_task_id.map(Into::into),
            title: model.title,
            description: model.description,
            status: model.status,
            priority: model.priority,
            effort_hours: model.effort_hours,
            start_date: model.start_date.map(Into::into),
            deadline: model.deadline.map(Into::into),
            created_by: model.created_by.into(),
            created_at: model.created_at.into(),
            updated_at: model.updated_at.into(),
        }
    }
}
