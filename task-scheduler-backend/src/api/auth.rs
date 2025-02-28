use actix_web::{web, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use crate::auth::{AuthService, AuthError};
use crate::email::EmailService;

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct SetNewPasswordRequest {
    pub token: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct FirebaseLoginRequest {
    pub firebase_token: String,
    pub email: String,
    pub name: String,
    pub firebase_uid: String,
}

pub fn auth_routes() -> Scope {
    web::scope("/auth")
        .route("/register", web::post().to(register))
        .route("/login", web::post().to(login))
        .route("/verify-email", web::post().to(verify_email))
        .route("/request-password-reset", web::post().to(request_password_reset))
        .route("/reset-password", web::post().to(reset_password)) 
        .route("/firebase/login", web::post().to(firebase_login))
}

async fn register(
    data: web::Json<RegisterRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    service
        .register_user(data.email.clone(), data.password.clone(), data.name.clone())
        .await?;

    Ok(HttpResponse::Ok().finish())
}

async fn login(
    data: web::Json<LoginRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    let token = service.login(data.email.clone(), data.password.clone()).await?;

    Ok(HttpResponse::Ok().json(LoginResponse { token }))
}

async fn verify_email(
    data: web::Json<VerifyEmailRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    // TODO: Implement email verification
    Ok(HttpResponse::Ok().finish())
}

async fn request_password_reset(
    data: web::Json<ResetPasswordRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    service.request_password_reset(data.email.clone()).await?;

    Ok(HttpResponse::Ok().finish())
}

async fn reset_password(
    data: web::Json<SetNewPasswordRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    // TODO: Implement password reset
    Ok(HttpResponse::Ok().finish())
}

async fn firebase_login(
    data: web::Json<FirebaseLoginRequest>,
    service: web::Data<AuthService<EmailService>>,
) -> Result<HttpResponse, AuthError> {
    // TODO: Verify Firebase token
    
    let token = service.register_firebase_user(
        data.email.clone(),
        data.name.clone(), 
        data.firebase_uid.clone()
    ).await?;

    Ok(HttpResponse::Ok().json(LoginResponse { token }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};
    use sea_orm::{DatabaseConnection, Database};

    #[actix_web::test]
    async fn test_register_endpoint() {
        let conn = Database::connect("sqlite::memory:").await.unwrap();
        let email_service = EmailService::new(
            "localhost".to_string(),
            "test".to_string(),
            "test".to_string(),
            "noreply@example.com".to_string(),
        ).unwrap();

        let auth_service = AuthService::new(
            conn,
            b"test_secret".to_vec(),
            email_service,
            "http://localhost:3000".to_string(),
        );

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(auth_service))
                .service(auth_routes())
        ).await;

        let req = test::TestRequest::post()
            .uri("/auth/register")
            .set_json(&RegisterRequest {
                email: "test@example.com".to_string(),
                password: "password123".to_string(),
                name: "Test User".to_string(),
            })
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
