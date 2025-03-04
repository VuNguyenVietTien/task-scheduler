use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::auth::{token, AuthError, AuthService};

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterData {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
    #[validate(length(min = 2))]
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginData {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: TokenResponse,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub verified: bool,
}

pub async fn register(
    data: web::Json<RegisterData>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    data.validate()
        .map_err(|e| AuthError::ValidationError(e.to_string()))?;

    let user_id = auth_service
        .register(
            data.0.email,
            data.0.password,
            data.0.display_name,
        )
        .await?;

    Ok(HttpResponse::Created().json(user_id))
}

pub async fn login(
    data: web::Json<LoginData>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    let claims = auth_service
        .login(data.0.email.clone(), data.0.password.clone())
        .await?;

    // Create token with claims
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AuthError::InvalidUserId)?;

    let (token_str, expires_in) = token::create_token(
        user_id,
        claims.email.clone(),
        claims.display_name.clone(),
    )?;

    let response = AuthResponse {
        token: TokenResponse { 
            token: token_str, 
            expires_in 
        },
        user: UserResponse {
            id: claims.sub,
            email: claims.email,
            display_name: claims.display_name,
            verified: true,
        },
    };

    Ok(HttpResponse::Ok().json(response))
}

pub async fn verify_email(
    token: web::Path<String>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    auth_service.verify_email(token.into_inner()).await?;
    Ok(HttpResponse::Ok().finish())
}

pub async fn request_password_reset(
    email: web::Json<String>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    auth_service.request_password_reset(email.into_inner()).await?;
    Ok(HttpResponse::Ok().finish())
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordData {
    pub token: String,
    pub new_password: String,
}

pub async fn reset_password(
    data: web::Json<ResetPasswordData>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    auth_service
        .reset_password(data.0.token.clone(), data.0.new_password.clone())
        .await?;
    Ok(HttpResponse::Ok().finish())
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/verify/{token}", web::get().to(verify_email))
            .route("/password-reset", web::post().to(request_password_reset))
            .route("/password-reset/confirm", web::post().to(reset_password))
            .route("/users/{user_id}/password", web::put().to(change_password))
    );
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordData {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    user_id: web::Path<Uuid>,
    data: web::Json<ChangePasswordData>,
    auth_service: web::Data<AuthService>,
) -> Result<impl Responder, AuthError> {
    auth_service
        .change_password(
            user_id.into_inner(),
            data.0.current_password.clone(),
            data.0.new_password.clone(),
        )
        .await?;
    Ok(HttpResponse::Ok().finish())
}
