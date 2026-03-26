use async_graphql::*;
use chrono::NaiveDateTime;

#[derive(SimpleObject)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub visibility: String,
    pub progress: i32,
    pub start_date: NaiveDateTime,
    pub end_date: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub owner: User,
}

#[derive(InputObject)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: String,
    pub priority: String,
    pub visibility: String,
    pub start_date: NaiveDateTime,
    pub end_date: Option<NaiveDateTime>,
}

#[derive(SimpleObject)]
pub struct User {
    pub id: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
} 