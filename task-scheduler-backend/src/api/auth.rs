use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::auth::{AuthError, AuthService};

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterData {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
    #[validate(length(min = 2))]
    pub name: String, // Changed from display_name to name
}

#[derive(Debug, Deserialize)]
pub struct LoginData {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub id: String,
    pub email: String,
    pub name: String,
}

pub async fn register(
    auth_service: web::Data<AuthService>,
    data: web::Json<RegisterData>,
) -> Result<impl Responder, AuthError> {
    let (access_token, _, user) = auth_service
        .register(data.email.clone(), data.password.clone(), data.name.clone()) 
        .await?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        id: user.id.to_string(),
        email: user.email, 
        name: user.name,
    }))
}

pub async fn login(
    auth_service: web::Data<AuthService>,
    data: web::Json<LoginData>,
) -> Result<impl Responder, AuthError> {
    let user = auth_service
        .login(data.email.clone(), data.password.clone())
        .await?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        id: user.id.to_string(),
        email: user.email,
        name: user.name,
    }))
}

pub async fn verify_email(
    auth_service: web::Data<AuthService>,
    token: web::Path<String>,
) -> Result<impl Responder, AuthError> {
    auth_service.verify_email(token.into_inner()).await?;
    Ok(HttpResponse::Ok().finish())
}

pub async fn request_password_reset(
    auth_service: web::Data<AuthService>,
    email: web::Json<String>,
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
    auth_service: web::Data<AuthService>,
    data: web::Json<ResetPasswordData>,
) -> Result<impl Responder, AuthError> {
    auth_service
        .reset_password(data.token.clone(), data.new_password.clone())
        .await?;
    Ok(HttpResponse::Ok().finish())
}

/// Configure authentication routes
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/verify-email/{token}", web::get().to(verify_email))
            .route("/request-password-reset", web::post().to(request_password_reset))
            .route("/reset-password", web::post().to(reset_password))
            .route("/users/{user_id}/change-password", web::post().to(change_password))
    );
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordData {
    pub old_password: String,
    pub new_password: String,
}

pub async fn change_password(
    auth_service: web::Data<AuthService>,
    user_id: web::Path<String>,
    data: web::Json<ChangePasswordData>,
) -> Result<impl Responder, AuthError> {
    let user_id = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| AuthError::InvalidUserId)?;

    auth_service
        .change_password(user_id, data.old_password.clone(), data.new_password.clone())
        .await?;
    Ok(HttpResponse::Ok().finish())
}