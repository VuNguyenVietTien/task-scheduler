use async_graphql::*;
use crate::graphql::Context;
use super::types::{ProjectMember, User};

#[derive(Default)]
pub struct MemberQuery;

#[Object]
impl MemberQuery {
    async fn project_members(&self, ctx: &Context, project_id: ID) -> Result<Vec<ProjectMember>> {
        // TODO: Implement
        Ok(vec![])
    }

    async fn project_member(&self, ctx: &Context, project_id: ID, member_id: ID) -> Result<ProjectMember> {
        // TODO: Implement
        Ok(ProjectMember {
            id: member_id.to_string(),
            user: User {
                id: "1".to_string(),
                username: "test_user".to_string(),
                full_name: Some("Test User".to_string()),
                avatar_url: None,
            },
            role: "MEMBER".to_string(),
            joined_at: chrono::Utc::now().naive_utc(),
        })
    }
} 