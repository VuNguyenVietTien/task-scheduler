use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgRow, Error as SqlxError, Row, Type};
use uuid::Uuid;

pub trait RowExt {
    fn get_string(&self, name: &str) -> Result<String, SqlxError>;
    fn get_bool(&self, name: &str) -> Result<bool, SqlxError>;
    fn get_uuid(&self, name: &str) -> Result<Uuid, SqlxError>;
}

impl RowExt for PgRow {
    fn get_string(&self, name: &str) -> Result<String, SqlxError> {
        self.try_get(name)
    }

    fn get_bool(&self, name: &str) -> Result<bool, SqlxError> {
        self.try_get(name)
    }

    fn get_uuid(&self, name: &str) -> Result<Uuid, SqlxError> {
        self.try_get(name)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub email: String,
    pub display_name: String,
}

impl Claims {
    pub fn new(user_id: String, email: String, display_name: String, duration: Duration) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            iat: now.timestamp(),
            exp: (now + duration).timestamp(),
            email,
            display_name,
        }
    }

    pub fn from_user(user: &User, duration: Duration) -> Self {
        Self::new(
            user.id.to_string(),
            user.email.clone(),
            user.name.clone(),
            duration,
        )
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() >= self.exp
    }

    pub fn user_id(&self) -> Result<Uuid, uuid::Error> {
        Uuid::parse_str(&self.sub)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub provider: UserProvider,
    pub password_hash: Option<String>,
    pub verified: bool,
    pub verification_token: Option<String>,
    pub verification_token_expires: Option<DateTime<Utc>>,
    pub reset_token: Option<String>,
    pub reset_token_expires: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "user_role", rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    User,
}

impl Default for UserRole {
    fn default() -> Self {
        Self::User
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "user_provider", rename_all = "lowercase")]
pub enum UserProvider {
    Email,
    Google,
    Github,
}

impl Default for UserProvider {
    fn default() -> Self {
        Self::Email
    }
}
