use async_graphql::{SimpleObject, ID};
use chrono::{DateTime, Utc};

#[derive(SimpleObject)]
pub struct UserResponse {
    pub id: ID,
    pub email: String,
    pub full_name: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub work_capacity: f32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::db::models::User> for UserResponse {
    fn from(user: crate::db::models::User) -> Self {
        Self {
            id: user.user_id.to_string().into(),
            email: user.email,
            full_name: user.full_name,
            username: user.username,
            avatar_url: user.avatar_url,
            bio: user.bio,
            work_capacity: user.work_capacity,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}
