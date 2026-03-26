use async_graphql::*;
use crate::graphql::Context;
use super::types::{Project, User, CreateProjectInput};

#[derive(Default)]
pub struct ProjectMutation;

#[Object]
impl ProjectMutation {
    async fn create_project(&self, ctx: &Context<'_>, input: CreateProjectInput) -> Result<Project> {
        // TODO: Implement create project mutation
        Ok(Project {
            id: "1".to_string(),
            name: input.name,
            description: input.description,
            status: "ACTIVE".to_string(),
            priority: input.priority,
            visibility: input.visibility,
            progress: 0,
            start_date: input.start_date,
            end_date: input.end_date,
            created_at: chrono::Utc::now().naive_utc(),
            updated_at: chrono::Utc::now().naive_utc(),
            owner: User {
                id: "1".to_string(),
                username: "test_user".to_string(),
                full_name: Some("Test User".to_string()),
                avatar_url: None,
            },
        })
    }
} 