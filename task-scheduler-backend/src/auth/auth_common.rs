use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;

use crate::{
    auth::{error::AuthError, token::{self, Claims}},
    Config,
};

pub async fn get_auth_info_from_token(
    token_str: &str,
    db: &PgPool,
    config: &Config,
) -> Result<(Uuid, String, String), AuthError> {
    let claims = token::verify_access_token(token_str, config)?;
    
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AuthError::InvalidToken("Invalid user ID".into()))?;
    
    // Verify user exists and is still active
    let row: PgRow = sqlx::query(
        "SELECT user_id, email, name FROM users WHERE user_id = $1 AND email_verified = true"
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| AuthError::InvalidToken("User not found".into()))?;

    Ok((
        row.get::<Uuid, _>("user_id"),
        row.get::<String, _>("email"),
        row.get::<String, _>("name"),
    ))
}

pub fn create_token(
    user_id: Uuid,
    email: String,
    username: String,
    config: &Config,
) -> Result<String, AuthError> {
    // Create access token and return just the token string
    let access_token = token::create_access_token(user_id, email, username, config)?;
    Ok(access_token.token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::postgres::{PgPool, PgPoolOptions};
    use std::env;

    async fn setup_test_db() -> PgPool {
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set");
        
        PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("Failed to create connection pool")
    }

    fn create_test_config() -> Config {
        Config {
            database_url: "".to_string(),
            redis_url: "".to_string(),
            server_host: "".to_string(),
            server_port: 8080,
            auth_secret: "test-auth-secret".to_string(),
            jwt_secret: "test-jwt-secret".to_string(),
            jwt_expiry: 3600,
            email_from: "".to_string(),
            email_smtp_host: "".to_string(),
            email_smtp_port: 587,
            email_smtp_user: "".to_string(),
            email_smtp_pass: "".to_string(),
        }
    }

    #[tokio::test]
    async fn test_token_flow() {
        let config = create_test_config();
        let pool = setup_test_db().await;
        
        // Create test user
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let name = "Test User".to_string();
        let password_hash = "hashed_password".to_string();

        sqlx::query(
            "INSERT INTO users (user_id, email, name, password_hash, email_verified) 
             VALUES ($1, $2, $3, $4, true)"
        )
        .bind(user_id)
        .bind(&email)
        .bind(&name)
        .bind(&password_hash)
        .execute(&pool)
        .await
        .expect("Failed to create test user");

        // Create token
        let token = create_token(user_id, email.clone(), name.clone(), &config)
            .expect("Failed to create token");

        // Verify token
        let (verified_id, verified_email, verified_name) = 
            get_auth_info_from_token(&token, &pool, &config)
            .await
            .expect("Failed to verify token");

        assert_eq!(verified_id, user_id);
        assert_eq!(verified_email, email);
        assert_eq!(verified_name, name);

        // Cleanup
        sqlx::query("DELETE FROM users WHERE user_id = $1")
            .bind(user_id)
            .execute(&pool)
            .await
            .expect("Failed to delete test user");
    }
}