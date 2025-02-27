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

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    token: String,
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
            .route("/verify", web::post().to(verify_token)),
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
        Ok(_) => HttpResponse::Created().json(web::Json(())),
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

async fn verify_token(
    auth_service: web::Data<AuthService>,
    token: web::Json<String>,
) -> impl Responder {
    match auth_service.verify_token(&token).await {
        Ok(claims) => HttpResponse::Ok().json(claims),
        Err(e) => {
            let (status, message) = e.error_response();
            HttpResponse::build(actix_web::http::StatusCode::from_u16(status).unwrap())
                .json(ErrorResponse { error: message })
        }
    }
}

// Middleware for protected routes
pub async fn auth_middleware(
    req: actix_web::dev::ServiceRequest,
    auth_service: web::Data<AuthService>,
) -> Result<actix_web::dev::ServiceRequest, actix_web::Error> {
    let auth_header = req.headers().get("Authorization")
        .ok_or(AuthError::InvalidToken)?
        .to_str()
        .map_err(|_| AuthError::InvalidToken)?;

    let token = auth_header.replace("Bearer ", "");
    
    match auth_service.verify_token(&token).await {
        Ok(claims) => {
            req.extensions_mut().insert(claims);
            Ok(req)
        }
        Err(e) => {
            let (status, message) = e.error_response();
            Err(actix_web::error::ErrorUnauthorized(message))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn test_register_endpoint() {
        let auth_service = web::Data::new(AuthService::new(
            // Use test database connection here
            database_connection,
            b"test_secret",
        ));

        let app = test::init_service(
            App::new()
                .app_data(auth_service.clone())
                .configure(config),
        )
        .await;

        let request = RegisterRequest {
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
            name: "Test User".to_string(),
        };

        let resp = test::TestRequest::post()
            .uri("/auth/register")
            .set_json(&request)
            .send_request(&app)
            .await;

        assert_eq!(resp.status(), actix_web::http::StatusCode::CREATED);
    }
}