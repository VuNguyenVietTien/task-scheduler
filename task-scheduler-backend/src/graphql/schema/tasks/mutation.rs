use async_graphql::*;
use crate::graphql::Context;
use super::types::{Task, User, CreateTaskInput};

#[derive(Default)]
pub struct TaskMutation;

#[Object]
impl TaskMutation {
    async fn create_task(&self, ctx: &Context<'_>, input: CreateTaskInput) -> Result<Task> {
        // TODO: Implement task creation
        Ok(Task {
            id: "1".to_string(),
            title: input.title,
            description: input.description,
            status: "TODO".to_string(),
            priority: input.priority,
            start_date: input.start_date,
            due_date: input.due_date,
            progress: 0,
            assignee: None,
            created_at: chrono::Utc::now().naive_utc(),
            updated_at: chrono::Utc::now().naive_utc(),
        })
    }
} 