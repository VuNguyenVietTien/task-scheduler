use async_graphql::*;
use uuid::Uuid;
use sqlx::{PgPool, Row};

#[derive(Enum, Copy, Clone, Eq, PartialEq, sqlx::Type)]
#[sqlx(type_name = "member_role", rename_all = "lowercase")]
pub enum MemberRole {
    Admin,
    Member,
    Viewer,
}

#[derive(SimpleObject)]
pub struct ProjectMember {
    pub member_id: String,
    pub project_id: String,
    pub user_id: String,
    pub role: MemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub invited_by: Option<String>,
    pub user: UserResponse,
}

#[derive(SimpleObject)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

impl TryFrom<sqlx::postgres::PgRow> for ProjectMember {
    type Error = sqlx::Error;

    fn try_from(row: sqlx::postgres::PgRow) -> Result<Self, Self::Error> {
        Ok(Self {
            member_id: row.get::<Uuid, _>("member_id").to_string(),
            project_id: row.get::<Uuid, _>("project_id").to_string(),
            user_id: row.get::<Uuid, _>("user_id").to_string(),
            role: row.get("role"),
            joined_at: row.get("joined_at"),
            invited_by: row.get::<Option<Uuid>, _>("invited_by").map(|id| id.to_string()),
            user: UserResponse {
                id: row.get::<Uuid, _>("user_id").to_string(),
                email: row.get("email"),
                username: row.get("username"),
                full_name: row.get("full_name"),
                avatar_url: row.get("avatar_url"),
            },
        })
    }
}

#[derive(InputObject)]
pub struct AddMemberInput {
    pub email: String,
    pub role: MemberRole,
}

#[derive(InputObject)]
pub struct UpdateMemberRoleInput {
    pub member_id: String,
    pub role: MemberRole,
} 