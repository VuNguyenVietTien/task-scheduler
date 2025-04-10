use actix_web::{web, HttpRequest, HttpResponse, Result};
use async_graphql::{
    http::{GraphiQLSource, ALL_WEBSOCKET_PROTOCOLS},
    Schema,
    ServerError, 
    Value,
    PathSegment,
};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use sqlx::PgPool;
use std::sync::Arc;
use std::ops::Deref;
use std::time::Instant;
use serde_json::{json, Value as JsonValue};

use crate::auth::{error::AuthError, jwt, types};
use crate::config::Config;
use crate::graphql::{
    schema::AppSchema,
    Context,
    dataloaders::{ProjectLoader, UserLoader},
};

pub async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
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

    // Extract and validate auth token
    let auth = if let Some(auth_header) = req.headers().get("Authorization") {
        eprintln!("Auth header found: {}", auth_header.to_str().unwrap_or("Invalid header"));
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token_str = auth_str[7..].to_string();
                match jwt::verify_token(&token_str, config.deref()) {
                    Ok(jwt_claims) => {
                        eprintln!("Token validated successfully for user: {}", jwt_claims.sub);
                        // Convert jwt::Claims to auth::types::Claims
                        Some(types::Claims {
                            sub: jwt_claims.sub.clone(),
                            exp: jwt_claims.exp as i64,  // Convert usize to i64
                            iat: jwt_claims.iat as i64,  // Convert usize to i64
                            email: jwt_claims.email,
                            display_name: jwt_claims.sub, // Use sub as display_name since it's not available in jwt::Claims
                        })
                    },
                    Err(e) => {
                        eprintln!("Token validation failed: {:?}", e);
                        None
                    }
                }
            } else {
                eprintln!("Not a Bearer token");
                None
            }
        } else {
            eprintln!("Invalid auth header format");
            None
        }
    } else {
        eprintln!("No Authorization header found");
        None
    };

    // Get inner pool without Arc wrapper
    let pool = pool.as_ref();
    let inner_pool = pool.as_ref().clone();

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
                if err.message.contains("enumeration type") && 
                   (err.message.contains("MemberRole") || err.message.contains("ProjectMemberRole")) {
                    eprintln!("  DETECTED ENUM PARSING ERROR FOR MemberRole!");
                    if let Some(extensions) = &err.extensions {
                        if let Some(value) = extensions.get("value") {
                            eprintln!("  Value being parsed: {:?}", value);
                        }
                    }
                    
                    // Hiển thị thêm thông tin về request
                    if let Some(argument_name) = err.message.split("argument \"").nth(1).and_then(|s| s.split("\"").next()) {
                        eprintln!("  Argument name: {}", argument_name);
                    }
                }
            }
            
            if let Some(extensions) = &err.extensions {
                eprintln!("  Extensions: {}", serde_json::to_string_pretty(extensions).unwrap_or_default());
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
    
    eprintln!("Response: {}", serde_json::to_string_pretty(&full_response).unwrap_or_default());
    eprintln!("======================\n");

    Ok(response.into())
}

pub async fn graphql_playground() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(GraphiQLSource::build()
            .endpoint("/graphql")
            .subscription_endpoint("/graphql")
            .finish()))
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
            AuthError::Unauthorized(_) => "UNAUTHORIZED",
            AuthError::Forbidden(_) => "FORBIDDEN",
            AuthError::Database(_) => "DATABASE_ERROR",
            AuthError::ValidationError(_) => "VALIDATION_ERROR",
            AuthError::InternalError(_) => "INTERNAL_ERROR",
            AuthError::Other(_) => "OTHER_ERROR",
        };

        async_graphql::Error::new(self.to_string()).extend_with(|_, e| {
            e.set("code", code)
        })
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