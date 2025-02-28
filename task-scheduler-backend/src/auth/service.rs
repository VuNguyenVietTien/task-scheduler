use sea_orm::{DatabaseConnection, Set, EntityTrait, IntoActiveModel, ActiveModelTrait, QueryFilter, ColumnTrait};
use crate::auth::{AuthError, token::Claims};
use crate::email::EmailServiceTrait;
use entity::users::Model as UserModel;
use entity::users::{Entity as Users, ActiveModel as UserActiveModel};
use chrono::{Duration, Utc, FixedOffset};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};

pub struct AuthService<E: EmailServiceTrait> {
    db: DatabaseConnection,
    jwt_secret: Vec<u8>,
    email_service: E,
    frontend_url: String,
}

impl<E: Clone + Send + Sync + EmailServiceTrait + 'static> AuthService<E> {
    pub fn new(
        db: DatabaseConnection,
        jwt_secret: Vec<u8>,
        email_service: E,
        frontend_url: String,
    ) -> Self {
        Self {
            db,
            jwt_secret,
            email_service,
            frontend_url,
        }
    }

    pub async fn register_user(
        &self,
        email: String,
        password: String,
        name: String,
    ) -> Result<(), AuthError> {
        // Check if user already exists
        if let Some(_) = super::find_by_email(&self.db, &email).await? {
            return Err(AuthError::EmailAlreadyExists);
        }

        // Hash password
        let hashed_password = hash(password.as_bytes(), DEFAULT_COST)?;

        // Generate verification token
        let verification_token = Uuid::new_v4().to_string();
        let verification_expires = Utc::now() + Duration::hours(24);

        // Create new user
        let user = UserActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(email.clone()),
            password_hash: Set(hashed_password),
            name: Set(name),
            email_verified: Set(false),
            verification_token: Set(Some(verification_token.clone())),
            verification_token_expires: Set(Some(verification_expires.with_timezone(&FixedOffset::east_opt(0).unwrap()))),
            role: Set("user".to_string()),
            work_capacity: Set(None),
            firebase_uid: Set(None),
            created_at: Set(Utc::now().with_timezone(&FixedOffset::east_opt(0).unwrap())),
            updated_at: Set(Utc::now().with_timezone(&FixedOffset::east_opt(0).unwrap())),
            provider: Set("email".to_string())
        };

        // Save user to database
        Users::insert(user)
            .exec(&self.db)
            .await?;

        // Send verification email
        self.email_service
            .send_verification_email(email, verification_token, self.frontend_url.clone())
            .await
            .map_err(|e| AuthError::EmailSendingFailed(e.to_string()))?;

        Ok(())
    }

    pub async fn login(&self, email: String, password: String) -> Result<String, AuthError> {
        let user = super::find_by_email(&self.db, &email)
            .await?
            .ok_or(AuthError::InvalidCredentials)?;

        if !user.email_verified {
            return Err(AuthError::EmailNotVerified);
        }

        if !verify(password.as_bytes(), &user.password_hash)? {
            return Err(AuthError::InvalidPassword);
        }

        let token = Claims::new(user.id, user.email, user.role)
            .create_token(&self.jwt_secret)?;

        Ok(token)
    }
    pub async fn register_firebase_user(
        &self,
        email: String,
        name: String,
        firebase_uid: String,
    ) -> Result<String, AuthError> {
        // Check if user already exists
        if let Some(mut user) = super::find_by_email(&self.db, &email).await? {
            // If user exists but doesn't have firebase_uid, update it
            if user.firebase_uid.is_none() {
                let mut user_am: UserActiveModel = user.clone().into();
                user_am.firebase_uid = Set(Some(firebase_uid));
                user_am.update(&self.db).await?;
            }
            // Generate token for existing user
            return Ok(Claims::new(user.id, user.email, user.role)
                .create_token(&self.jwt_secret)?);
        }

        // Create new user
        let user = UserActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(email.clone()),
            password_hash: Set("".to_string()), // No password for Firebase users
            name: Set(name),
            email_verified: Set(true), // Firebase handles email verification
            verification_token: Set(None),
            verification_token_expires: Set(None),
            role: Set("user".to_string()),
            work_capacity: Set(None),
            firebase_uid: Set(Some(firebase_uid)),
            created_at: Set(Utc::now().with_timezone(&FixedOffset::east_opt(0).unwrap())),
            updated_at: Set(Utc::now().with_timezone(&FixedOffset::east_opt(0).unwrap())),
            provider: Set("firebase".to_string())
        };

        // Save user to database
        let user = Users::insert(user)
            .exec(&self.db)
            .await?;

        // Generate token for new user
        let token = Claims::new(user.last_insert_id, email, "user".to_string())
            .create_token(&self.jwt_secret)?;

        Ok(token)
    }

    pub async fn get_user_by_firebase_uid(&self, firebase_uid: String) -> Result<Option<UserModel>, AuthError> {
        let user = Users::find()
            .filter(entity::users::Column::FirebaseUid.eq(Some(firebase_uid)))
            .one(&self.db)
            .await?;
        Ok(user)
    }



    pub async fn request_password_reset(&self, email: String) -> Result<(), AuthError> {
        let mut user = super::find_by_email(&self.db, &email)
            .await?
            .ok_or(AuthError::UserNotFound)?;

        if !user.email_verified {
            return Err(AuthError::EmailNotVerified);
        }

        let reset_token = Uuid::new_v4().to_string();
        let reset_token_expires = Utc::now() + Duration::hours(1);

        // Update user with reset token
        user.verification_token = Some(reset_token.clone());
        user.verification_token_expires = Some(reset_token_expires.with_timezone(&FixedOffset::east_opt(0).unwrap()));

        // Save changes
        Users::update(user.into_active_model())
            .exec(&self.db)
            .await?;

        // Send reset email
        self.email_service
            .send_password_reset(email, reset_token, self.frontend_url.clone())
            .await
            .map_err(|e| AuthError::EmailSendingFailed(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;
    use crate::email::EmailService;

    #[tokio::test]
    async fn test_register_user() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        let email_service = EmailService::new(
            "localhost".to_string(),
            "test".to_string(), 
            "test".to_string(),
            "noreply@example.com".to_string(),
        ).unwrap();

        let service = AuthService::new(
            db,
            b"test_secret".to_vec(),
            email_service,
            "http://localhost:3000".to_string(),
        );

        let result = service
            .register_user(
                "test@example.com".to_string(),
                "password123".to_string(),
                "Test User".to_string(),
            )
            .await;

        assert!(result.is_ok());
    }
}
