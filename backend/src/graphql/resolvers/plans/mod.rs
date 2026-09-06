pub mod mutation;
pub mod query;

// Export PlanQuery và PlanMutation từ submodules
pub use mutation::PlanMutation;
pub use query::PlanQuery;

// --- GraphQL Object Type for Plan ---

use async_graphql::{Context, Error as GraphQLError, InputObject, Json, Object, Result, ID};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::error::AppError;
use crate::graphql::types::User;

#[derive(Debug, Clone)]
pub struct Plan {
    pub plan_id: ID,
    pub project_id: ID,
    pub name: String,
    pub description: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
    pub plan_data: Json<serde_json::Value>,

    // Sử dụng async_graphql::Object attribute thay vì graphql(skip)
    // Fields không được expose ra GraphQL
    pub(crate) raw_created_by: Uuid,
    pub(crate) raw_project_id: Uuid,
}

// --- Field Resolvers for Plan (Complex Fields) ---
#[Object]
impl Plan {
    // Resolver for the `createdBy` field
    async fn created_by(&self, _ctx: &Context<'_>) -> Result<User> {
        // Trong phiên bản hiện tại, chỉ trả về một stub User
        // Sẽ cần triển khai đầy đủ trong tương lai
        Err("Not implemented yet".into())
    }
}

// --- GraphQL Input Types ---

#[derive(InputObject, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct CreatePlanInput {
    pub project_id: ID,
    pub name: String,
    pub description: Option<String>,
    pub plan_data: Json<serde_json::Value>,
}

#[derive(InputObject, Debug)]
#[graphql(rename_fields = "snake_case")]
pub struct UpdatePlanInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub plan_data: Option<Json<serde_json::Value>>,
}

// Helper function (có thể sẽ được chuyển vào một helper module sau)
fn get_user_uuid_from_session(session_user_id: Option<String>) -> Result<Uuid, GraphQLError> {
    let user_id_str =
        session_user_id.ok_or_else(|| GraphQLError::new("User not found in session"))?;
    Uuid::parse_str(&user_id_str)
        .map_err(|_| GraphQLError::new("Invalid user ID format in session"))
}
