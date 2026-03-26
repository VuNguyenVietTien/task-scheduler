use async_graphql::*;
use crate::graphql::Context;
use super::types::{Task, User};

#[derive(Default)]
pub struct TaskQuery;

#[Object]
impl TaskQuery {
    async fn task(&self, ctx: &Context<'_>, task_id: ID) -> Result<Task> {
        // TODO: Implement task query
        Ok(Task {
            id: task_id.to_string(),
            title: "Test Task".to_string(),
            description: "Test Description".to_string(),
            status: "TODO".to_string(),
            priority: "MEDIUM".to_string(),
            start_date: chrono::Utc::now().naive_utc(),
            due_date: None,
            progress: 0,
            assignee: None,
            created_at: chrono::Utc::now().naive_utc(),
            updated_at: chrono::Utc::now().naive_utc(),
        })
    }
} 