use async_graphql::{Context, Object, ID, Result, InputObject};
use uuid::Uuid;
use sqlx::{PgPool, Row};

pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub email_verified: bool,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[Object]
impl UserResponse {
    async fn id(&self) -> &str {
        &self.id
    }

    async fn email(&self) -> &str {
        &self.email
    }

    async fn username(&self) -> &str {
        &self.username
    }

    async fn full_name(&self) -> Option<&str> {
        self.full_name.as_deref()
    }

    async fn avatar_url(&self) -> Option<&str> {
        self.avatar_url.as_deref()
    }

    async fn email_verified(&self) -> bool {
        self.email_verified
    }

    async fn role(&self) -> &str {
        &self.role
    }

    async fn created_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.created_at
    }

    async fn updated_at(&self) -> chrono::DateTime<chrono::Utc> {
        self.updated_at
    }
}

impl TryFrom<sqlx::postgres::PgRow> for UserResponse {
    type Error = sqlx::Error;

    fn try_from(row: sqlx::postgres::PgRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: row.get::<Uuid, _>("user_id").to_string(),
            email: row.get("email"),
            username: row.get("username"),
            full_name: row.get("full_name"),
            avatar_url: row.get("avatar_url"),
            email_verified: row.get("email_verified"),
            role: row.get("role"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}

#[derive(Default)]
pub struct UserQuery;

#[Object]
impl UserQuery {
    pub async fn me(&self, ctx: &Context<'_>) -> Result<UserResponse> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;

        let record = sqlx::query(
            "SELECT user_id, email, username, full_name, avatar_url, email_verified, role, created_at, updated_at 
             FROM users WHERE user_id = $1"
        )
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| UserResponse::try_from(row))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .transpose()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?
        .ok_or_else(|| async_graphql::Error::new("User not found"))?;

        Ok(record)
    }

    pub async fn user(&self, ctx: &Context<'_>, id: ID) -> Result<Option<UserResponse>> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = Uuid::parse_str(&id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;

        let record = sqlx::query(
            "SELECT user_id, email, username, full_name, avatar_url, email_verified, role, created_at, updated_at 
             FROM users WHERE user_id = $1"
        )
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| UserResponse::try_from(row))
        .fetch_optional(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .transpose()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }

    pub async fn users(&self, ctx: &Context<'_>) -> Result<Vec<UserResponse>> {
        let db = ctx.data::<PgPool>().unwrap();

        let records = sqlx::query(
            "SELECT user_id, email, username, full_name, avatar_url, email_verified, role, created_at, updated_at 
             FROM users ORDER BY created_at DESC"
        )
        .map(|row: sqlx::postgres::PgRow| UserResponse::try_from(row))
        .fetch_all(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(records)
    }
}

#[derive(Debug, InputObject)]
pub struct UpdateUserProfileInput {
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Default)]
pub struct UserMutation;

#[Object]
impl UserMutation {
    pub async fn update_profile(
        &self,
        ctx: &Context<'_>,
        input: UpdateUserProfileInput,
    ) -> Result<UserResponse> {
        let db = ctx.data::<PgPool>().unwrap();
        let user_id = ctx.data::<String>().unwrap();
        let user_id = Uuid::parse_str(user_id)
            .map_err(|_| async_graphql::Error::new("Invalid user ID"))?;

        let record = sqlx::query(
            "UPDATE users 
             SET 
                full_name = COALESCE($1, full_name),
                avatar_url = COALESCE($2, avatar_url),
                updated_at = NOW() 
             WHERE user_id = $3
             RETURNING user_id, email, username, full_name, avatar_url, email_verified, role, created_at, updated_at"
        )
        .bind(input.full_name)
        .bind(input.avatar_url)
        .bind(user_id)
        .map(|row: sqlx::postgres::PgRow| UserResponse::try_from(row))
        .fetch_one(db)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Database error: {}", e)))?
        .map_err(|e| async_graphql::Error::new(format!("Row mapping error: {}", e)))?;

        Ok(record)
    }
}
