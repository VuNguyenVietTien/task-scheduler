use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::{postgres::PgRow, PgPool, Row};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::auth::types::Claims;
use crate::config::Config;

pub async fn get_auth_info_from_token(
    token: &str,
    db: &PgPool,
) -> Result<(Uuid, String, String), AuthError> {
    let claims = decode_token(token)?;
    
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
    name: String,
    config: &Config,
) -> Result<(String, DateTime<Utc>), AuthError> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::seconds(config.jwt_expiry))
        .ok_or_else(|| AuthError::TokenCreation("Failed to create expiration time".into()))?;

    let claims = Claims::new(
        user_id.to_string(),
        email,
        name,
        Duration::seconds(config.jwt_expiry),
    );

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok((token, expiration))
}

pub fn decode_token(token: &str) -> Result<Claims, AuthError> {
    // Get config from env vars since we don't always have access to app state
    let jwt_secret = std::env::var("JWT_SECRET")
        .map_err(|_| AuthError::TokenVerification("JWT_SECRET not configured".into()))?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| AuthError::TokenVerification(e.to_string()))?;

    let claims = token_data.claims;

    // Check if token is expired
    if claims.is_expired() {
        return Err(AuthError::TokenExpired);
    }

    Ok(claims)
}

pub fn verify_token(token: &str, config: &Config) -> Result<Claims, AuthError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| AuthError::TokenVerification(e.to_string()))?;

    let claims = token_data.claims;

    // Check if token is expired
    if claims.is_expired() {
        return Err(AuthError::TokenExpired);
    }

    Ok(claims)
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn test_token_creation_and_verification() {
        let config = create_test_config();
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let name = "Test User".to_string();

        let (token, _) = create_token(user_id, email.clone(), name.clone(), &config)
            .expect("Token creation should succeed");

        let claims = verify_token(&token, &config).expect("Token verification should succeed");
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.email, email);
        assert_eq!(claims.display_name, name);
    }

    #[test]
    fn test_token_expiration() {
        let mut config = create_test_config();
        config.jwt_expiry = -3600; // Expired 1 hour ago

        let user_id = Uuid::new_v4();
        let (token, _) = create_token(
            user_id,
            "test@example.com".to_string(),
            "Test User".to_string(),
            &config,
        )
        .expect("Token creation should succeed");

        let result = verify_token(&token, &config);
        assert!(matches!(result, Err(AuthError::TokenExpired)));
    }
}