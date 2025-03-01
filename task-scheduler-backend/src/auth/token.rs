use chrono::{Duration, Utc};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::auth::AuthError;

pub type AuthResult<T> = Result<T, AuthError>;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub role: String,
    pub exp: i64,
}

impl Claims {
    pub fn new(user_id: Uuid, email: String, role: String) -> Self {
        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(24))
            .expect("failed to calculate expiration")
            .timestamp();

        Claims {
            sub: user_id,
            email,
            role,
            exp: expiration,
        }
    }

    pub fn create_token(&self, secret: &[u8]) -> AuthResult<String> {
        encode(
            &Header::default(),
            &self,
            &EncodingKey::from_secret(secret),
        )
        .map_err(|e| AuthError::TokenCreationError(e))
    }

    pub fn decode_token(token: &str, secret: &[u8]) -> AuthResult<Self> {
        decode(
            token,
            &DecodingKey::from_secret(secret),
            &Validation::default()
        )
        .map(|token_data| token_data.claims)
        .map_err(|e| AuthError::TokenVerificationError(e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_create_token() {
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let role = "user".to_string();
        let secret = b"test_secret";

        let claims = Claims::new(user_id, email, role);
        let token = claims.create_token(secret);

        assert!(token.is_ok());
    }
}
