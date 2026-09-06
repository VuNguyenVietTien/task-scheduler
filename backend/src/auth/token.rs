use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::Config;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,          // Subject (user ID)
    pub exp: i64,             // Expiration time
    pub iat: i64,             // Issued at
    pub email: String,        // User email
    pub display_name: String, // User display name
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, display_name: String, duration: Duration) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id.to_string(),
            exp: (now + duration).timestamp(),
            iat: now.timestamp(),
            email,
            display_name,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = Utc::now().timestamp();
        self.exp < now
    }
}

pub fn create_access_token(
    user_id: Uuid,
    email: String,
    name: String,
    config: &Config,
) -> Result<AccessToken, AuthError> {
    let expiry = Duration::seconds(config.jwt_expiry);
    let claims = Claims::new(user_id, email, name, expiry);

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok(AccessToken {
        token,
        expires_at: Utc::now() + expiry,
    })
}

pub fn verify_access_token(token: &str, config: &Config) -> Result<Claims, AuthError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| match e.kind() {
        // Preserve the expired-token classification (mirrors auth::jwt::verify_token);
        // previously this fell into TokenVerification and broke test_expired_token.
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
        _ => AuthError::TokenVerification(e.to_string()),
    })?;

    let claims = token_data.claims;

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
            ..Default::default()
        }
    }

    #[test]
    fn test_token_creation_and_verification() {
        let config = create_test_config();
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let name = "Test User".to_string();

        let access_token = create_access_token(user_id, email.clone(), name.clone(), &config)
            .expect("Token creation should succeed");

        let claims = verify_access_token(&access_token.token, &config)
            .expect("Token verification should succeed");

        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.email, email);
        assert_eq!(claims.display_name, name);
        assert!(!claims.is_expired());
    }

    #[test]
    fn test_expired_token() {
        let config = create_test_config();
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let name = "Test User".to_string();

        // Create claims with negative duration to simulate expired token
        let claims = Claims::new(
            user_id,
            email,
            name,
            Duration::seconds(-3600), // Expired 1 hour ago
        );

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
        )
        .unwrap();

        let result = verify_access_token(&token, &config);
        assert!(matches!(result, Err(AuthError::TokenExpired)));
    }
}
