use async_graphql::*;
use chrono::NaiveDateTime;

#[derive(SimpleObject)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub start_date: NaiveDateTime,
    pub due_date: Option<NaiveDateTime>,
    pub progress: i32,
    pub assignee: Option<User>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(InputObject)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: String,
    pub priority: String,
    pub start_date: NaiveDateTime,
    pub due_date: Option<NaiveDateTime>,
}

#[derive(SimpleObject)]
pub struct User {
    pub id: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
} 