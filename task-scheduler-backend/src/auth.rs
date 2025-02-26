use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration};
use crate::error::{AppError, AppResult};
use crate::config::Config;
use crate::db::entities::user::{self, UserRole};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub exp: i64,  // Expiration timestamp
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

impl AuthUser {
    pub fn from_user(user: &user::Model) -> Self {
        let exp = (Utc::now() + Duration::hours(1)).timestamp();
        Self {
            id: user.id,
            email: user.email.clone(),
            role: user.role.clone(),
            exp,
        }
    }

    pub fn is_admin(&self) -> bool {
        self.role == UserRole::Admin.to_string()
    }

    pub fn is_manager(&self) -> bool {
        self.role == UserRole::Manager.to_string()
    }

    pub fn can_manage_users(&self) -> bool {
        self.is_admin()
    }

    pub fn can_manage_project(&self) -> bool {
        self.is_admin() || self.is_manager()
    }
}

pub struct Auth;

impl Auth {
    pub fn create_tokens(user: &user::Model, config: &Config) -> AppResult<TokenPair> {
        let auth_user = AuthUser::from_user(user);
        
        // Create access token (1 hour expiry)
        let access_token = encode(
            &Header::default(),
            &auth_user,
            &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
        ).map_err(|e| AppError::Auth(e.to_string()))?;

        // Create refresh token (7 days expiry)
        let refresh_exp = (Utc::now() + Duration::days(7)).timestamp();
        let refresh_claims = json!({
            "user_id": user.id,
            "exp": refresh_exp
        });
        let refresh_token = encode(
            &Header::default(),
            &refresh_claims,
            &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
        ).map_err(|e| AppError::Auth(e.to_string()))?;

        Ok(TokenPair {
            access_token,
            refresh_token,
        })
    }

    pub fn verify_token(token: &str, config: &Config) -> AppResult<AuthUser> {
        let decoded = decode::<AuthUser>(
            token,
            &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
            &Validation::new(Algorithm::HS256),
        ).map_err(|e| AppError::Auth(e.to_string()))?;

        Ok(decoded.claims)
    }

    pub fn hash_password(password: &str) -> AppResult<String> {
        bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
        bcrypt::verify(password, hash)
            .map_err(|e| AppError::Internal(e.to_string()))
    }
}

pub async fn get_auth_user_from_request(req: &actix_web::HttpRequest, config: &Config) -> Option<AuthUser> {
    let auth_header = req.headers().get("Authorization")?;
    let auth_str = auth_header.to_str().ok()?;
    
    if !auth_str.starts_with("Bearer ") {
        return None;
    }

    let token = auth_str[7..].trim();
    Auth::verify_token(token, config).ok()
}

// Middleware guard for protected routes
pub struct AuthGuard;

impl actix_web::guard::Guard for AuthGuard {
    fn check(&self, ctx: &actix_web::guard::GuardContext) -> bool {
        if let Some(auth_header) = ctx.head().headers().get("Authorization") {
            auth_header.to_str().map_or(false, |h| h.starts_with("Bearer "))
        } else {
            false
        }
    }
}

// Role-based guard
pub struct RoleGuard(pub Vec<UserRole>);

impl actix_web::guard::Guard for RoleGuard {
    fn check(&self, ctx: &actix_web::guard::GuardContext) -> bool {
        if let Some(user) = ctx.head().extensions().get::<AuthUser>() {
            self.0.iter().any(|role| role.to_string() == user.role)
        } else {
            false
        }
    }
}

// Helper function to create role guards
pub fn requires_roles(roles: Vec<UserRole>) -> RoleGuard {
    RoleGuard(roles)
}
