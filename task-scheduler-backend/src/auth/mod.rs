mod password;
mod error;

use error::AuthError;
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait};
use entity::{users, users::Entity as Users};

pub use password::PasswordHasher;
pub use error::AuthError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: i64,
    pub iat: i64,
    pub role: String,
}

pub struct AuthService {
    db: DatabaseConnection,
    token_manager: TokenManager,
}

impl AuthService {
    pub fn new(db: DatabaseConnection, secret: &[u8]) -> Self {
        Self {
            db,
            token_manager: TokenManager::new(secret),
        }
    }

    pub async fn register_user(
        &self,
        email: String,
        password: String,
        name: String,
    ) -> Result<users::Model, AuthError> {
        // Check if email already exists
        if let Some(_) = Users::find()
            .filter(users::Column::Email.eq(&email))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))? {
            return Err(AuthError::EmailAlreadyExists);
        }

        // Hash password
        let password_hash = PasswordHasher::hash_password(&password)?;

        // Create user
        let user = users::ActiveModel {
            id: sea_orm::Set(Uuid::new_v4()),
            email: sea_orm::Set(email),
            password_hash: sea_orm::Set(password_hash),
            name: sea_orm::Set(name),
            role: sea_orm::Set("USER".to_string()),
            email_verified: sea_orm::Set(false),
            provider: sea_orm::Set("email".to_string()),
            created_at: sea_orm::Set(Utc::now()),
            updated_at: sea_orm::Set(Utc::now()),
            ..Default::default()
        };

        let user = user
            .insert(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        Ok(user)
    }

    pub async fn login(
        &self,
        email: String,
        password: String,
    ) -> Result<String, AuthError> {
        // Find user
        let user = Users::find()
            .filter(users::Column::Email.eq(&email))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::UserNotFound)?;

        // Verify password
        if !PasswordHasher::verify_password(&password, &user.password_hash)? {
            return Err(AuthError::InvalidPassword);
        }

        // Generate token
        let token = self.token_manager.generate_token(user.id, user.role)?;

        Ok(token)
    }

    pub async fn verify_token(&self, token: &str) -> Result<Claims, AuthError> {
        self.token_manager.verify_token(token)
    }
}

struct TokenManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl TokenManager {
    fn new(secret: &[u8]) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
        }
    }

    fn generate_token(&self, user_id: Uuid, role: String) -> Result<String, AuthError> {
        let now = Utc::now();
        let exp = (now + Duration::hours(24)).timestamp();
        
        let claims = Claims {
            sub: user_id,
            exp,
            iat: now.timestamp(),
            role,
        };

        encode(
            &Header::default(),
            &claims,
            &self.encoding_key,
        ).map_err(AuthError::TokenCreationError)
    }

    fn verify_token(&self, token: &str) -> Result<Claims, AuthError> {
        let validation = Validation::new(Algorithm::HS256);
        let token_data = decode::<Claims>(
            token,
            &self.decoding_key,
            &validation,
        ).map_err(|_| AuthError::InvalidToken)?;

        let claims = token_data.claims;

        // Check expiration
        if claims.exp < Utc::now().timestamp() {
            return Err(AuthError::TokenExpired);
        }

        Ok(claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation_and_verification() {
        let secret = b"test_secret";
        let token_manager = TokenManager::new(secret);
        let user_id = Uuid::new_v4();
        let role = "USER".to_string();

        // Generate token
        let token = token_manager.generate_token(user_id, role.clone()).unwrap();
        
        // Verify token
        let claims = token_manager.verify_token(&token).unwrap();
        
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.role, role);
        assert!(claims.exp > Utc::now().timestamp());
    }
}