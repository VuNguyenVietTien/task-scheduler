use crate::auth::{AuthService, AuthError};
use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
pub struct RequestPasswordResetRequest {
    email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    token: String,
    new_password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    token: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    message: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    error: String,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/verify-email", web::post().to(verify_email))
            .route("/request-password-reset", web::post().to(request_password_reset))
            .route("/reset-password", web::post().to(reset_password)),
    );
}

async fn register(
    auth_service: web::Data<AuthService>,
    request: web::Json<RegisterRequest>,
) -> impl Responder {
    match auth_service.register_user(
        request.email.clone(),
        request.password.clone(),
        request.name.clone(),
    ).await {
        Ok(_) => HttpResponse::Created().json(MessageResponse {
            message: "Registration successful. Please check your email to verify your account.".to_string()
        }),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

async fn login(
    auth_service: web::Data<AuthService>,
    request: web::Json<LoginRequest>,
) -> impl Responder {
    match auth_service.login(
        request.email.clone(),
        request.password.clone(),
    ).await {
        Ok(token) => HttpResponse::Ok().json(AuthResponse { token }),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

async fn verify_email(
    auth_service: web::Data<AuthService>,
    request: web::Json<VerifyEmailRequest>,
) -> impl Responder {
    match auth_service.verify_email(request.token.clone()).await {
        Ok(_) => HttpResponse::Ok().json(MessageResponse {
            message: "Email verified successfully".to_string()
        }),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

async fn request_password_reset(
    auth_service: web::Data<AuthService>,
    request: web::Json<RequestPasswordResetRequest>,
) -> impl Responder {
    match auth_service.request_password_reset(request.email.clone()).await {
        Ok(_) => HttpResponse::Ok().json(MessageResponse {
            message: "If an account exists with this email, you will receive a password reset link".to_string()
        }),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

async fn reset_password(
    auth_service: web::Data<AuthService>,
    request: web::Json<ResetPasswordRequest>,
) -> impl Responder {
    match auth_service.reset_password(
        request.token.clone(),
        request.new_password.clone(),
    ).await {
        Ok(_) => HttpResponse::Ok().json(MessageResponse {
            message: "Password reset successfully".to_string()
        }),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn test_register_endpoint() {
        // TODO: Implement tests with mock auth service
    }

    #[actix_web::test]
    async fn test_verify_email_endpoint() {
        // TODO: Implement tests
    }

    #[actix_web::test]
    async fn test_password_reset_endpoints() {
        // TODO: Implement tests
    }
}