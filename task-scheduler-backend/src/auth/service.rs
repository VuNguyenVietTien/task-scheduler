use sqlx::{PgPool, Row};
use uuid::Uuid;
use crate::{
    auth::{error::AuthError, auth_common, password},
    config::Config,
    graphql::types::User,
};

pub struct AuthService {
    db: PgPool,
}

impl AuthService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn register(
        &self,
        email: String,
        password: String,
        name: String,
    ) -> Result<(String, String, User), AuthError> {
        // Check if email exists
        let exists = sqlx::query(
            "SELECT user_id FROM users WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?;

        if exists.is_some() {
            return Err(AuthError::EmailAlreadyExists);
        }

        let user_id = Uuid::new_v4();
        
        // Hash password
        let password_hash = password::hash(password)
            .map_err(|e| AuthError::Other(e.to_string()))?;
        
        // Insert new user
        sqlx::query(
            "INSERT INTO users (user_id, email, password_hash, username) 
             VALUES ($1, $2, $3, $4)"
        )
        .bind(user_id)
        .bind(&email)
        .bind(&password_hash)
        .bind(&name)
        .execute(&self.db)
        .await?;

        // Create tokens
        let config = Config::from_env()
            .map_err(|e| AuthError::Other(e.to_string()))?;

        let token = auth_common::create_token(
            user_id,
            email.clone(),
            name.clone(),
            &config,
        )?;

        let user = User {
            id: user_id,
            email,
            name,
        };

        Ok((token.clone(), token, user))
    }

    pub async fn register_firebase_user(
        &self,
        email: String,
        name: String,
        firebase_uid: String,
    ) -> Result<(String, String, User), AuthError> {
        // Check if user exists by firebase_uid
        let existing_user = sqlx::query(
            "SELECT user_id, email, username
             FROM users 
             WHERE firebase_uid = $1"
        )
        .bind(&firebase_uid)
        .fetch_optional(&self.db)
        .await?;

        let user = if let Some(row) = existing_user {
            // User exists, return existing user
            User {
                id: row.get("user_id"),
                email: row.get("email"),
                name: row.get("username"),
            }
        } else {
            // Create new user
            let user_id = Uuid::new_v4();

            sqlx::query(
                "INSERT INTO users (user_id, email, username, firebase_uid)
                 VALUES ($1, $2, $3, $4)"
            )
            .bind(user_id)
            .bind(&email)
            .bind(&name)
            .bind(&firebase_uid)
            .execute(&self.db)
            .await?;

            User {
                id: user_id,
                email: email.clone(),
                name: name.clone(),
            }
        };

        // Create JWT token
        let config = Config::from_env()
            .map_err(|e| AuthError::Other(e.to_string()))?;

        let token = auth_common::create_token(
            user.id,
            email,
            name,
            &config,
        )?;

        Ok((token.clone(), token, user))
    }

    pub async fn login(&self, email: String, password: String) -> Result<User, AuthError> {
        // Update query to include the name column
        let row = sqlx::query(
            "SELECT user_id, email, username, password_hash 
             FROM users 
             WHERE email = $1"
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?
        .ok_or(AuthError::InvalidCredentials)?;

        let stored_hash: String = row.get("password_hash");

        // Verify password
        if !password::verify_password(&password, &stored_hash)
            .map_err(|e| AuthError::Other(e.to_string()))? {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(User {
            id: row.get("user_id"),
            email: row.get("email"), 
            name: row.get("username"),
        })
    }

    pub async fn verify_email(&self, token: String) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn request_password_reset(&self, email: String) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn reset_password(&self, token: String, new_password: String) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn change_password(&self, user_id: Uuid, old_password: String, new_password: String) -> Result<(), AuthError> {
        Ok(())
    }
}
