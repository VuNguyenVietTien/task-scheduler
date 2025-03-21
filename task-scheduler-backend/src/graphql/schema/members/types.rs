use async_graphql::*;

#[derive(SimpleObject)]
pub struct ProjectMember {
    pub id: String,
    pub user: User,
    pub role: String,
    pub joined_at: chrono::NaiveDateTime,
}

#[derive(SimpleObject)]
pub struct User {
    pub id: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(InputObject)]
pub struct AddMemberInput {
    pub email: String,
    pub role: String,
}

#[derive(InputObject)]
pub struct UpdateMemberInput {
    pub role: String,
} 