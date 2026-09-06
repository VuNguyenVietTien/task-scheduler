use actix_web::{web, HttpRequest, HttpResponse, Result};
use async_graphql::{
    http::{GraphiQLSource, ALL_WEBSOCKET_PROTOCOLS},
    PathSegment, Schema, ServerError, Value,
};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use serde_json::{json, Value as JsonValue};
use sqlx::PgPool;
use std::future::Future;
use std::sync::Arc;
use std::time::Instant;

use crate::api::auth::{self, AppAuthIdentity};
use crate::auth::{error::AuthError, identity, types::Claims};
use crate::config::Config;
use crate::firebase::FirebaseService;
use crate::graphql::{
    dataloaders::{ProjectLoader, UserLoader},
    schema::AppSchema,
    Context,
};

pub async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
    firebase_service: web::Data<FirebaseService>,
    project_loader: web::Data<ProjectLoader>,
    user_loader: web::Data<UserLoader>,
) -> Result<GraphQLResponse> {
    let start = Instant::now();
    eprintln!("\n=== GraphQL Handler Start ===");

    // Log dependencies availability
    eprintln!("All dependencies loaded");

    // Convert request to string for logging
    let request = gql_req.into_inner();
    eprintln!("Query: {}", request.query);
    eprintln!("Variables: {:?}", request.variables);
    eprintln!("Operation Name: {:?}", request.operation_name);

    // Extract and resolve identity from the Bearer token.
    // Dual verification (Phase 2): Supabase HS256 access token first (resolved to
    // the app users.user_id by email), then the backend's own legacy JWT, so web
    // (Supabase) and mobile (legacy) clients are both served.
    let inner_pool = pool.as_ref().as_ref().clone();

    let auth = match req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
    {
        Some(token_str) => {
            let token_str = token_str.to_string();
            // Never log raw tokens.
            eprintln!("Auth header found (Bearer, {} chars)", token_str.len());
            let primary_pool = inner_pool.clone();
            let primary_config = config.get_ref().clone();
            let fallback_pool = inner_pool.clone();
            let fallback_config = config.get_ref().clone();
            let fallback_firebase = firebase_service.clone();

            match resolve_graphql_claims_with_fallback(
                &token_str,
                move |token| async move {
                    identity::resolve_bearer_claims(&token, &primary_pool, &primary_config).await
                },
                move |token| async move {
                    auth::resolve_app_identity(
                        &token,
                        &fallback_pool,
                        &fallback_config,
                        fallback_firebase.get_ref(),
                    )
                    .await
                },
            )
            .await
            {
                Ok(claims) => {
                    eprintln!(
                        "Identity resolved for {} (sub={})",
                        claims.email, claims.sub
                    );
                    Some(claims)
                }
                Err(e) => {
                    eprintln!("Token validation failed: {:?}", e);
                    None
                }
            }
        }
        None => {
            eprintln!("No Bearer Authorization header found");
            None
        }
    };

    // Create new context with auth
    let context = Context::new(
        inner_pool,
        auth,
        project_loader.get_ref().clone(),
        user_loader.get_ref().clone(),
        config.get_ref().clone(),
    );

    let schema = schema.get_ref();
    let mut request = request;

    // Hiển thị thông tin trước khi thực thi
    eprintln!("GraphQL Request: {:?}", request);

    request = request.data(context);
    let response = schema.execute(request).await;

    let duration = start.elapsed();

    eprintln!("\n=== GraphQL Response ===");
    eprintln!("Duration: {:?}", duration);

    // Chi tiết hóa thông tin lỗi thay vì chỉ hiển thị errors: true
    if response.errors.len() > 0 {
        eprintln!("ERRORS DETAILS:");
        for (i, err) in response.errors.iter().enumerate() {
            eprintln!("Error #{}: {}", i + 1, err);

            // Kiểm tra path an toàn hơn
            if !err.path.is_empty() {
                eprintln!("  Path: {:?}", err.path);

                // Debug thêm về argument errors nếu lỗi liên quan đến MemberRole
                if err.message.contains("enumeration type")
                    && (err.message.contains("MemberRole")
                        || err.message.contains("ProjectMemberRole"))
                {
                    eprintln!("  DETECTED ENUM PARSING ERROR FOR MemberRole!");
                    if let Some(extensions) = &err.extensions {
                        if let Some(value) = extensions.get("value") {
                            eprintln!("  Value being parsed: {:?}", value);
                        }
                    }

                    // Hiển thị thêm thông tin về request
                    if let Some(argument_name) = err
                        .message
                        .split("argument \"")
                        .nth(1)
                        .and_then(|s| s.split("\"").next())
                    {
                        eprintln!("  Argument name: {}", argument_name);
                    }
                }
            }

            if let Some(extensions) = &err.extensions {
                eprintln!(
                    "  Extensions: {}",
                    serde_json::to_string_pretty(extensions).unwrap_or_default()
                );
            }
            eprintln!("  Message: {}", err.message);
            if !err.locations.is_empty() {
                eprintln!("  Locations: {:?}", err.locations);
            }
        }
    }

    // Tạo phiên bản đầy đủ của response để log
    let full_response = json!({
        "data": response.data.clone(),
        "errors": if response.errors.len() > 0 {
            response.errors.iter().map(|e| {
                json!({
                    "message": e.message.clone(),
                    "path": e.path.clone(),
                    "extensions": e.extensions.clone(),
                    "locations": e.locations.clone()
                })
            }).collect::<Vec<_>>()
        } else {
            Vec::<JsonValue>::new()
        }
    });

    eprintln!(
        "Response: {}",
        serde_json::to_string_pretty(&full_response).unwrap_or_default()
    );
    eprintln!("======================\n");

    Ok(response.into())
}

async fn resolve_graphql_claims_with_fallback<P, PFut, F, FFut>(
    token: &str,
    primary_verify: P,
    firebase_verify: F,
) -> Result<Claims, AuthError>
where
    P: FnOnce(String) -> PFut,
    PFut: Future<Output = Result<Claims, AuthError>>,
    F: FnOnce(String) -> FFut,
    FFut: Future<Output = Result<AppAuthIdentity, AuthError>>,
{
    let token = token.to_string();
    match primary_verify(token.clone()).await {
        Ok(claims) => Ok(claims),
        Err(_) => firebase_verify(token).await.map(|identity| {
            Claims::new(
                identity.user_id.to_string(),
                identity.email,
                identity.display_name,
                chrono::Duration::hours(1),
            )
        }),
    }
}

pub async fn graphql_playground() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(
            GraphiQLSource::build()
                .endpoint("/graphql")
                .subscription_endpoint("/graphql")
                .finish(),
        ))
}

pub async fn graphql_ws_handler(
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> Result<GraphQLResponse, actix_web::Error> {
    let schema = schema.get_ref();
    let request = req.into_inner();
    let response = schema.execute(request).await;
    Ok(response.into())
}

pub trait IntoGraphQLError {
    fn to_graphql_error(self) -> async_graphql::Error;
}

impl IntoGraphQLError for AuthError {
    fn to_graphql_error(self) -> async_graphql::Error {
        use async_graphql::ErrorExtensions;

        let code = match &self {
            AuthError::InvalidCredentials => "INVALID_CREDENTIALS",
            AuthError::InvalidToken(_) => "INVALID_TOKEN",
            AuthError::TokenExpired => "TOKEN_EXPIRED",
            AuthError::TokenCreation(_) => "TOKEN_CREATION_ERROR",
            AuthError::TokenVerification(_) => "TOKEN_VERIFICATION_ERROR",
            AuthError::UserNotFound => "USER_NOT_FOUND",
            AuthError::InvalidUserId => "INVALID_USER_ID",
            AuthError::EmailExists => "EMAIL_EXISTS",
            AuthError::Unauthorized(_) => "UNAUTHORIZED",
            AuthError::Forbidden(_) => "FORBIDDEN",
            AuthError::Database(_) => "DATABASE_ERROR",
            AuthError::ValidationError(_) => "VALIDATION_ERROR",
            AuthError::InternalError(_) => "INTERNAL_ERROR",
            AuthError::Other(_) => "OTHER_ERROR",
        };

        async_graphql::Error::new(self.to_string()).extend_with(|_, e| e.set("code", code))
    }
}

#[async_trait::async_trait]
pub trait GraphQLErrorExt {
    async fn error(&self, err: impl IntoGraphQLError + Send) -> async_graphql::Error;
}

#[async_trait::async_trait]
impl<T> GraphQLErrorExt for T
where
    T: Send + Sync,
{
    async fn error(&self, err: impl IntoGraphQLError + Send) -> async_graphql::Error {
        err.to_graphql_error()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::auth::AppAuthIdentity;
    use uuid::Uuid;

    #[tokio::test]
    async fn firebase_fallback_provides_graphql_app_claims_when_primary_rejects_token() {
        let app_user_id = Uuid::new_v4();

        let claims = resolve_graphql_claims_with_fallback(
            "firebase-id-token",
            |_token| async {
                Err(AuthError::InvalidToken(
                    "not a Supabase or legacy token".to_string(),
                ))
            },
            |_token| async move {
                Ok(AppAuthIdentity {
                    user_id: app_user_id,
                    email: "xekobanh@gmail.com".to_string(),
                    display_name: "Vu Tien".to_string(),
                    email_verified: true,
                })
            },
        )
        .await
        .expect("verified Firebase identity should authenticate GraphQL");

        assert_eq!(claims.sub, app_user_id.to_string());
        assert_eq!(claims.email, "xekobanh@gmail.com");
        assert_eq!(claims.display_name, "Vu Tien");
        assert!(!claims.is_expired());
    }
}
