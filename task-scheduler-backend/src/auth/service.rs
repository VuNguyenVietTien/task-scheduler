use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::auth::token;
use crate::auth::types::{Claims, RowExt};
use crate::config::{JWT_EXPIRY, RESET_TOKEN_EXPIRY, VERIFICATION_TOKEN_EXPIRY};

#[derive(Clone)]
pub struct AuthService {
    db: PgPool,
}

impl AuthService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn register(
        &self,
        email: String,
        password: String,
        display_name: String,
    ) -> Result<Uuid, AuthError> {
        // Check if email exists
        let exists = sqlx::query(
            "SELECT user_id FROM users WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?;

        if exists.is_some() {
            return Err(AuthError::EmailAlreadyExists);
        }

        // Hash password
        let password_hash = hash(password.as_bytes(), DEFAULT_COST)
            .map_err(|e| AuthError::PasswordError(e.to_string()))?;

        // Create user
        let user_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (user_id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, 'user')"
        )
        .bind(user_id)
        .bind(&email)
        .bind(&password_hash)
        .bind(&display_name)
        .execute(&self.db)
        .await?;

        Ok(user_id)
    }

    pub async fn login(&self, email: String, password: String) -> Result<Claims, AuthError> {
        let user = sqlx::query(
            "SELECT user_id, password_hash, display_name, verified FROM users WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?
        .ok_or(AuthError::InvalidCredentials)?;

        // Use helper methods from RowExt
        let password_hash: String = user.get_string("password_hash")?;
        let valid = verify(password.as_bytes(), &password_hash)
            .map_err(|e| AuthError::PasswordError(e.to_string()))?;

        if !valid {
            return Err(AuthError::InvalidCredentials);
        }

        let verified = user.get_bool("verified")?;
        if !verified {
            return Err(AuthError::EmailNotVerified);
        }

        let user_id = user.get_uuid("user_id")?;
        let display_name = user.get_string("display_name")?;

        let expiry = *JWT_EXPIRY;
        let claims = Claims::new(
            user_id.to_string(),
            email,
            display_name,
            Duration::seconds(expiry),
        );

        Ok(claims)
    }

    pub async fn verify_email(&self, token: String) -> Result<(), AuthError> {
        let user_id = self.verify_token(&token, VERIFICATION_TOKEN_EXPIRY).await?;

        sqlx::query(
            "UPDATE users SET verified = true WHERE user_id = $1"
        )
        .bind(user_id)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn request_password_reset(&self, email: String) -> Result<(), AuthError> {
        let user = sqlx::query(
            "SELECT user_id, display_name FROM users WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?
        .ok_or(AuthError::UserNotFound)?;

        let user_id = user.get_uuid("user_id")?;
        let display_name = user.get_string("display_name")?;

        let reset_token = token::create_token(
            user_id,
            email,
            display_name,
        )?.0;

        // TODO: Send reset email
        println!("Reset token: {}", reset_token);

        Ok(())
    }

    pub async fn reset_password(
        &self,
        token: String,
        new_password: String,
    ) -> Result<(), AuthError> {
        let user_id = self.verify_token(&token, RESET_TOKEN_EXPIRY).await?;

        let password_hash = hash(new_password.as_bytes(), DEFAULT_COST)
            .map_err(|e| AuthError::PasswordError(e.to_string()))?;

        sqlx::query(
            "UPDATE users SET password_hash = $1 WHERE user_id = $2"
        )
        .bind(&password_hash)
        .bind(user_id)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: String,
        new_password: String,
    ) -> Result<(), AuthError> {
        let user = sqlx::query(
            "SELECT password_hash FROM users WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or(AuthError::UserNotFound)?;

        let password_hash = user.get_string("password_hash")?;
        let valid = verify(current_password.as_bytes(), &password_hash)
            .map_err(|e| AuthError::PasswordError(e.to_string()))?;

        if !valid {
            return Err(AuthError::InvalidCredentials);
        }

        let password_hash = hash(new_password.as_bytes(), DEFAULT_COST)
            .map_err(|e| AuthError::PasswordError(e.to_string()))?;

        sqlx::query(
            "UPDATE users SET password_hash = $1 WHERE user_id = $2"
        )
        .bind(&password_hash)
        .bind(user_id)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    async fn verify_token(&self, token: &str, max_age: i64) -> Result<Uuid, AuthError> {
        let claims = token::verify_token(token)?;

        // Check token age
        let exp = claims.exp;
        let now = Utc::now().timestamp();

        if now - exp > max_age {
            return Err(AuthError::TokenExpired);
        }

        claims.sub.parse::<Uuid>()
            .map_err(|_| AuthError::InvalidUserId)
    }
}
