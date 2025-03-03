use async_graphql::*;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::db::entities::task;

#[derive(SimpleObject)]
pub struct Task {
    pub id: ID,
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub effort_hours: Option<f32>,
    pub start_date: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub created_by: ID,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(InputObject)]
pub struct CreateTaskInput {
    pub project_id: ID,
    pub parent_task_id: Option<ID>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub effort_hours: Option<f32>,
    pub start_date: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub assignee_ids: Vec<ID>,
}

#[derive(InputObject)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub effort_hours: Option<f32>,
    pub start_date: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub assignee_ids: Option<Vec<ID>>,
}

#[derive(InputObject)]
pub struct TaskOrder {
    pub task_id: ID,
    pub priority_order: i32,
}

#[derive(InputObject)]
pub struct ReorderTasksInput {
    pub task_orders: Vec<TaskOrder>,
}

// Implement conversion from database model to GraphQL type
impl From<task::Model> for Task {
    fn from(model: task::Model) -> Self {
        Self {
            id: model.id.into(),
            project_id: model.project_id.into(),
            parent_task_id: model.parent_task_id.map(Into::into),
            title: model.title,
            description: model.description,
            status: model.status,
            priority: model.priority,
            effort_hours: model.effort_hours,
            start_date: model.start_date.map(|d| d.into()),
            deadline: model.deadline.map(|d| d.into()),
            created_by: model.created_by.into(),
            created_at: model.created_at.into(),
            updated_at: model.updated_at.into(),
        }
    }
}