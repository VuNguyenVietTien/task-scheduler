use async_graphql::*;
use crate::graphql::Context;
use super::types::{Project, User};

#[derive(Default)]
pub struct ProjectQuery;

#[Object]
impl ProjectQuery {
    async fn project(&self, ctx: &Context<'_>, project_id: ID) -> Result<Project> {
        // TODO: Implement project query
        Ok(Project {
            id: project_id.to_string(),
            name: "Test Project".to_string(),
            description: "Test Description".to_string(),
            status: "ACTIVE".to_string(),
            priority: "MEDIUM".to_string(),
            visibility: "PUBLIC".to_string(),
            progress: 0,
            start_date: chrono::Utc::now().naive_utc(),
            end_date: None,
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