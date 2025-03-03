use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::config::Config;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: i64,
    pub email: String,
    pub name: String,
    pub role: String,
}

pub fn create_token(
    user_id: Uuid,
    email: &str,
    name: &str,
    role: &str,
    config: &Config,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::seconds(config.jwt_expiry))
        .expect("Invalid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id,
        exp: expiration,
        email: email.to_string(),
        name: name.to_string(),
        role: role.to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
}

pub fn verify_token(token: &str, config: &Config) -> Result<Claims, jsonwebtoken::errors::Error> {
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(decoded.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_flow() {
        let config = Config {
            jwt_secret: "test-secret".to_string(),
            jwt_expiry: 3600,
            ..Default::default()
        };

        let user_id = Uuid::new_v4();
        let token = create_token(
            user_id,
            "test@example.com",
            "Test User",
            "user",
            &config,
        )
        .unwrap();

        let claims = verify_token(&token, &config).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.email, "test@example.com");
        assert_eq!(claims.name, "Test User");
        assert_eq!(claims.role, "user");
    }
}