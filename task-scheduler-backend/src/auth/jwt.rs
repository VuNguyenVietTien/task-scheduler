use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::Config;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // Subject (user ID)
    pub exp: usize,      // Expiration time (UTC timestamp)
    pub iat: usize,      // Issued at (UTC timestamp)
    pub email: String,   // User email
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, exp: usize) -> Self {
        let now = chrono::Utc::now().timestamp() as usize;
        Self {
            sub: user_id.to_string(),
            exp,
            iat: now,
            email,
        }
    }
}

pub fn create_token(claims: &Claims, config: &Config) -> Result<String, AuthError> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))
}

pub fn verify_token(token: &str, config: &Config) -> Result<Claims, AuthError> {
    let validation = Validation::default();
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
        _ => AuthError::TokenVerification(e.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

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
    fn test_jwt_flow() {
        let config = create_test_config();
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let exp = (Utc::now() + Duration::hours(1)).timestamp() as usize;

        let claims = Claims::new(user_id, email.clone(), exp);
        let token = create_token(&claims, &config).unwrap();
        let decoded = verify_token(&token, &config).unwrap();

        assert_eq!(decoded.sub, user_id.to_string());
        assert_eq!(decoded.email, email);
        assert_eq!(decoded.exp, exp);
    }

    #[test]
    fn test_expired_token() {
        let config = create_test_config();
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let exp = (Utc::now() - Duration::hours(1)).timestamp() as usize;

        let claims = Claims::new(user_id, email, exp);
        let token = create_token(&claims, &config).unwrap();
        let result = verify_token(&token, &config);

        assert!(matches!(result, Err(AuthError::TokenExpired)));
    }
}