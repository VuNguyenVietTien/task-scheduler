use async_graphql::*;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::db::entities::{task, user, project, comment, attachment};

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct User {
    pub id: ID,
    pub email: String,
    pub name: String,
    pub role: String,
    pub work_capacity: f32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[ComplexObject]
impl User {
    async fn tasks(&self, ctx: &Context<'_>) -> Result<Vec<Task>> {
        // To be implemented
        Ok(vec![])
    }

    async fn projects(&self, ctx: &Context<'_>) -> Result<Vec<Project>> {
        // To be implemented
        Ok(vec![])
    }
}

#[derive(SimpleObject)]
#[graphql(complex)]
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

#[ComplexObject]
impl Task {
    async fn project(&self, ctx: &Context<'_>) -> Result<Project> {
        // To be implemented
        todo!()
    }

    async fn parent_task(&self, ctx: &Context<'_>) -> Result<Option<Task>> {
        // To be implemented
        Ok(None)
    }

    async fn subtasks(&self, ctx: &Context<'_>) -> Result<Vec<Task>> {
        // To be implemented
        Ok(vec![])
    }

    async fn creator(&self, ctx: &Context<'_>) -> Result<User> {
        // To be implemented
        todo!()
    }

    async fn assignees(&self, ctx: &Context<'_>) -> Result<Vec<User>> {
        // To be implemented
        Ok(vec![])
    }

    async fn comments(&self, ctx: &Context<'_>) -> Result<Vec<Comment>> {
        // To be implemented
        Ok(vec![])
    }

    async fn attachments(&self, ctx: &Context<'_>) -> Result<Vec<Attachment>> {
        // To be implemented
        Ok(vec![])
    }
}

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct Project {
    pub id: ID,
    pub name: String,
    pub description: Option<String>,
    pub created_by: ID,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[ComplexObject]
impl Project {
    async fn creator(&self, ctx: &Context<'_>) -> Result<User> {
        // To be implemented
        todo!()
    }

    async fn tasks(&self, ctx: &Context<'_>) -> Result<Vec<Task>> {
        // To be implemented
        Ok(vec![])
    }

    async fn members(&self, ctx: &Context<'_>) -> Result<Vec<ProjectMember>> {
        // To be implemented
        Ok(vec![])
    }
}

#[derive(SimpleObject)]
pub struct ProjectMember {
    pub project_id: ID,
    pub user_id: ID,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct Comment {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub content: String,
    pub parent_comment_id: Option<ID>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[ComplexObject]
impl Comment {
    async fn task(&self, ctx: &Context<'_>) -> Result<Task> {
        // To be implemented
        todo!()
    }

    async fn user(&self, ctx: &Context<'_>) -> Result<User> {
        // To be implemented
        todo!()
    }

    async fn parent_comment(&self, ctx: &Context<'_>) -> Result<Option<Comment>> {
        // To be implemented
        Ok(None)
    }

    async fn replies(&self, ctx: &Context<'_>) -> Result<Vec<Comment>> {
        // To be implemented
        Ok(vec![])
    }
}

#[derive(SimpleObject)]
#[graphql(complex)]
pub struct Attachment {
    pub id: ID,
    pub task_id: ID,
    pub user_id: ID,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_path: String,
    pub created_at: DateTime<Utc>,
}

#[ComplexObject]
impl Attachment {
    async fn task(&self, ctx: &Context<'_>) -> Result<Task> {
        // To be implemented
        todo!()
    }

    async fn user(&self, ctx: &Context<'_>) -> Result<User> {
        // To be implemented
        todo!()
    }
}

// Input types for mutations
#[derive(InputObject)]
pub struct CreateUserInput {
    pub email: String,
    pub password: String,
    pub name: String,
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
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct AddProjectMemberInput {
    pub project_id: ID,
    pub user_id: ID,
    pub role: String,
}

#[derive(InputObject)]
pub struct CreateCommentInput {
    pub task_id: ID,
    pub content: String,
    pub parent_comment_id: Option<ID>,
}
