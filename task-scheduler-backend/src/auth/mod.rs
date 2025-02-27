mod password;
mod error;

use error::AuthError;
use crate::email::EmailService;
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set, ActiveModelTrait};
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
    email_service: EmailService,
    frontend_url: String,
}

impl AuthService {
    pub fn new(
        db: DatabaseConnection,
        secret: &[u8],
        email_service: EmailService,
        frontend_url: String,
    ) -> Self {
        Self {
            db,
            token_manager: TokenManager::new(secret),
            email_service,
            frontend_url,
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

        // Generate verification token
        let verification_token = Uuid::new_v4().to_string();
        let verification_expires = Utc::now() + Duration::hours(24);

        // Create user
        let user = users::ActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(email.clone()),
            password_hash: Set(password_hash),
            name: Set(name.clone()),
            role: Set("USER".to_string()),
            email_verified: Set(false),
            verification_token: Set(Some(verification_token.clone())),
            verification_token_expires: Set(Some(verification_expires)),
            provider: Set("email".to_string()),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
            ..Default::default()
        };

        let user = user
            .insert(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        // Send verification email
        let verification_link = format!(
            "{}/verify-email?token={}",
            self.frontend_url,
            verification_token
        );

        self.email_service
            .send_verification_email(&email, &name, &verification_link)
            .await
            .map_err(|e| AuthError::InternalServerError(e.to_string()))?;

        Ok(user)
    }

    pub async fn verify_email(
        &self,
        token: String,
    ) -> Result<(), AuthError> {
        let user = Users::find()
            .filter(users::Column::VerificationToken.eq(Some(token.clone())))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::InvalidToken)?;

        if user.email_verified {
            return Ok(());
        }

        // Check token expiration
        if let Some(expires) = user.verification_token_expires {
            if expires < Utc::now() {
                return Err(AuthError::TokenExpired);
            }
        }

        let mut user: users::ActiveModel = user.into();
        user.email_verified = Set(true);
        user.verification_token = Set(None);
        user.verification_token_expires = Set(None);
        user.updated_at = Set(Utc::now());

        user.update(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    pub async fn request_password_reset(
        &self,
        email: String,
    ) -> Result<(), AuthError> {
        let user = Users::find()
            .filter(users::Column::Email.eq(&email))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::UserNotFound)?;

        let reset_token = Uuid::new_v4().to_string();
        let reset_expires = Utc::now() + Duration::hours(1);

        let mut user: users::ActiveModel = user.into();
        user.verification_token = Set(Some(reset_token.clone()));
        user.verification_token_expires = Set(Some(reset_expires));
        user.updated_at = Set(Utc::now());

        user.update(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        let reset_link = format!(
            "{}/reset-password?token={}",
            self.frontend_url,
            reset_token
        );

        self.email_service
            .send_password_reset_email(&email, &user.name.unwrap(), &reset_link)
            .await
            .map_err(|e| AuthError::InternalServerError(e.to_string()))?;

        Ok(())
    }

    pub async fn reset_password(
        &self,
        token: String,
        new_password: String,
    ) -> Result<(), AuthError> {
        let user = Users::find()
            .filter(users::Column::VerificationToken.eq(Some(token.clone())))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::InvalidToken)?;

        if let Some(expires) = user.verification_token_expires {
            if expires < Utc::now() {
                return Err(AuthError::TokenExpired);
            }
        }

        let password_hash = PasswordHasher::hash_password(&new_password)?;

        let mut user: users::ActiveModel = user.into();
        user.password_hash = Set(password_hash);
        user.verification_token = Set(None);
        user.verification_token_expires = Set(None);
        user.updated_at = Set(Utc::now());

        user.update(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    pub async fn login(
        &self,
        email: String,
        password: String,
    ) -> Result<String, AuthError> {
        let user = Users::find()
            .filter(users::Column::Email.eq(&email))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::UserNotFound)?;

        if !user.email_verified {
            return Err(AuthError::EmailNotVerified);
        }

        if !PasswordHasher::verify_password(&password, &user.password_hash)? {
            return Err(AuthError::InvalidPassword);
        }

        let token = self.token_manager.generate_token(user.id, user.role)?;

        Ok(token)
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

        if claims.exp < Utc::now().timestamp() {
            return Err(AuthError::TokenExpired);
        }

        Ok(claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::*;

    mock! {
        EmailService {}
        impl EmailService {
            fn send_verification_email(&self, to: &str, name: &str, link: &str) -> Result<(), Box<dyn std::error::Error>>;
            fn send_password_reset_email(&self, to: &str, name: &str, link: &str) -> Result<(), Box<dyn std::error::Error>>;
        }
    }

    #[tokio::test]
    async fn test_register_user() {
        // TODO: Implement tests
    }

    #[tokio::test]
    async fn test_verify_email() {
        // TODO: Implement tests
    }

    #[tokio::test]
    async fn test_password_reset() {
        // TODO: Implement tests
    }
}