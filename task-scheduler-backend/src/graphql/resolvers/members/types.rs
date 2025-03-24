use async_graphql::*;
use uuid::Uuid;
use sqlx::{PgPool, Row};
use serde;

#[derive(Enum, Copy, Clone, Eq, PartialEq, sqlx::Type, Debug)]
#[graphql(name = "ProjectMemberRole")]
#[sqlx(type_name = "member_role", rename_all = "lowercase")]
pub enum MemberRole {
    #[graphql(name = "Admin")]
    Admin,
    #[graphql(name = "Member")]
    Member,
    #[graphql(name = "Viewer")]
    Viewer,
}

impl MemberRole {
    // Hàm chuyển đổi từ chuỗi sang enum mà không phân biệt cách viết hoa/thường
    pub fn from_str_case_insensitive(s: &str) -> Option<Self> {
        let lowercase = s.to_lowercase();
        match lowercase.as_str() {
            "admin" => Some(MemberRole::Admin),
            "member" => Some(MemberRole::Member),
            "viewer" => Some(MemberRole::Viewer),
            _ => None,
        }
    }
}

// Implement Deserialize để có thể chuyển đổi từ chuỗi GraphQL query
impl<'de> serde::Deserialize<'de> for MemberRole {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        // Deserialize thành chuỗi trước
        let s = String::deserialize(deserializer)?;
        
        // Chuyển đổi từ chuỗi sang enum, không phân biệt hoa thường
        MemberRole::from_str_case_insensitive(&s)
            .ok_or_else(|| {
                serde::de::Error::custom(format!(
                    "Giá trị không hợp lệ cho enum MemberRole: {}. Chỉ chấp nhận: admin/member/viewer (không phân biệt hoa/thường)", s
                ))
            })
    }
}

#[derive(SimpleObject)]
#[graphql(name = "ResolverProjectMember")]
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
#[graphql(name = "MemberUserResponse")]
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

// Định nghĩa mới cho các hoạt động hàng loạt

#[derive(InputObject)]
pub struct MemberRoleUpdate {
    pub user_id: ID,
    pub role: MemberRole,
}

#[derive(SimpleObject)]
pub struct BulkUpdateResponse {
    pub success_count: i32,
    pub members: Vec<ProjectMember>,
}

#[derive(SimpleObject)]
pub struct BulkRemoveResponse {
    pub success_count: i32,
    pub failed_count: i32,
} 