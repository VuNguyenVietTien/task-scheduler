use actix_web::{web, HttpResponse, HttpRequest};
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub exp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub exp: i64,
}

pub fn create_token(user_id: Uuid, email: &str) -> AppResult<String> {
    let exp = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("invalid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_id,
        email: email.to_string(),
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(std::env::var("JWT_SECRET").unwrap().as_bytes()),
    )
    .map_err(AppError::from)
}

pub fn verify_token(token: &str) -> AppResult<Claims> {
    let secret = std::env::var("JWT_SECRET").unwrap();
    decode(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(AppError::from)
}

pub fn refresh_token(claims: &Claims) -> AppResult<String> {
    let refresh_claims = json!({
        "sub": claims.sub,
        "email": claims.email,
        "exp": Utc::now()
            .checked_add_signed(Duration::days(7))
            .expect("invalid timestamp")
            .timestamp()
    });

    encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(std::env::var("JWT_REFRESH_SECRET").unwrap().as_bytes()),
    )
    .map_err(AppError::from)
}
