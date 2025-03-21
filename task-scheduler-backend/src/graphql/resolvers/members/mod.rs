pub mod query;
pub mod mutation;

use async_graphql::{Context, Object, Result, ID};
use crate::graphql::types::{ProjectMember, MemberRole};

#[derive(Default)]
pub struct MemberQuery;

#[Object]
impl MemberQuery {
    async fn project_members(&self, ctx: &Context<'_>, project_id: ID) -> Result<Vec<ProjectMember>> {
        query::project_members(ctx, project_id).await
    }

    async fn project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
    ) -> Result<Option<ProjectMember>> {
        query::project_member(ctx, project_id, user_id).await
    }
    
    /// Get the current user's role in a specific project
    async fn my_project_role(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
    ) -> Result<Option<MemberRole>> {
        query::my_project_role(ctx, project_id).await
    }
}

#[derive(Default)]
pub struct MemberMutation;

#[Object]
impl MemberMutation {
    async fn add_project_member_by_email(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        email: String,
        role: MemberRole
    ) -> Result<ProjectMember> {
        mutation::add_member_by_email(ctx, project_id, email, role).await
    }

    async fn update_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID,
        role: MemberRole
    ) -> Result<ProjectMember> {
        mutation::update_member(ctx, project_id, user_id, role).await
    }

    async fn remove_project_member(
        &self,
        ctx: &Context<'_>,
        project_id: ID,
        user_id: ID
    ) -> Result<bool> {
        mutation::remove_member(ctx, project_id, user_id).await
    }
} 