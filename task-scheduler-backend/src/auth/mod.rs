mod password;
mod error;

use error::AuthError;
use crate::email::EmailService;
use crate::firebase::{FirebaseService, FirebaseUser, FirebaseError};
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
    pub firebase_uid: Option<String>,
}

pub struct AuthService {
    db: DatabaseConnection,
    token_manager: TokenManager,
    email_service: EmailService,
    firebase_service: Option<FirebaseService>,
    frontend_url: String,
}

impl AuthService {
    pub fn new(
        db: DatabaseConnection,
        secret: &[u8],
        email_service: EmailService,
        firebase_service: Option<FirebaseService>,
        frontend_url: String,
    ) -> Self {
        Self {
            db,
            token_manager: TokenManager::new(secret),
            email_service,
            firebase_service,
            frontend_url,
        }
    }

    pub async fn firebase_login(
        &self,
        firebase_token: &str,
    ) -> Result<String, AuthError> {
        let firebase = self.firebase_service
            .as_ref()
            .ok_or(AuthError::InternalServerError("Firebase not configured".to_string()))?;

        // Verify Firebase token
        let (firebase_user, roles) = firebase
            .verify_token_and_get_claims(firebase_token)
            .await
            .map_err(|e| AuthError::InternalServerError(e.to_string()))?;

        // Find or create user
        let user = self.find_or_create_firebase_user(firebase_user).await?;

        // Generate JWT token
        let token = self.token_manager.generate_token(
            user.id,
            user.role,
            Some(user.firebase_uid.unwrap_or_default()),
        )?;

        Ok(token)
    }

    async fn find_or_create_firebase_user(
        &self,
        firebase_user: FirebaseUser,
    ) -> Result<users::Model, AuthError> {
        // Try to find existing user by Firebase UID
        if let Some(user) = Users::find()
            .filter(users::Column::FirebaseUid.eq(Some(firebase_user.uid.clone())))
            .one(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))? {
            return Ok(user);
        }

        // Try to find user by email
        if let Some(email) = &firebase_user.email {
            if let Some(user) = Users::find()
                .filter(users::Column::Email.eq(email))
                .one(&self.db)
                .await
                .map_err(|e| AuthError::DatabaseError(e.to_string()))? {
                // Link existing user with Firebase
                let mut user: users::ActiveModel = user.into();
                user.firebase_uid = Set(Some(firebase_user.uid.clone()));
                user.provider = Set(firebase_user.provider.clone());
                user.updated_at = Set(Utc::now());
                
                return user.update(&self.db)
                    .await
                    .map_err(|e| AuthError::DatabaseError(e.to_string()));
            }
        }

        // Create new user
        let user = users::ActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(firebase_user.email.unwrap_or_default()),
            name: Set(firebase_user.name.unwrap_or_default()),
            password_hash: Set("".to_string()), // Firebase users don't need password
            role: Set("USER".to_string()),
            email_verified: Set(firebase_user.email_verified),
            firebase_uid: Set(Some(firebase_user.uid)),
            provider: Set(firebase_user.provider),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
            ..Default::default()
        };

        user.insert(&self.db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))
    }

    // ... other existing methods ...
}

impl TokenManager {
    fn generate_token(
        &self,
        user_id: Uuid,
        role: String,
        firebase_uid: Option<String>,
    ) -> Result<String, AuthError> {
        let now = Utc::now();
        let exp = (now + Duration::hours(24)).timestamp();
        
        let claims = Claims {
            sub: user_id,
            exp,
            iat: now.timestamp(),
            role,
            firebase_uid,
        };

        encode(
            &Header::default(),
            &claims,
            &self.encoding_key,
        ).map_err(AuthError::TokenCreationError)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::*;

    mock! {
        FirebaseService {}
        impl FirebaseService {
            fn verify_token_and_get_claims(
                &self,
                token: &str,
            ) -> Result<(FirebaseUser, Vec<String>), Box<dyn std::error::Error>>;
        }
    }

    #[tokio::test]
    async fn test_firebase_login() {
        // TODO: Implement tests for Firebase login
    }
}