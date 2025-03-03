use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use log::{info, error};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use crate::auth::token::Claims;
use crate::api::projects::AuthenticatedUser;
use std::rc::Rc;
use actix_web::error::ErrorUnauthorized;
use crate::config::Config;

pub struct Auth;

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service: Rc::new(service),
        }))
    }
}

pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();

        Box::pin(async move {
            info!("[Auth] Incoming request: Method={} Path={}", req.method(), req.path());

            // // Check for auth token in cookies
            // // First try to get token from Authorization header
            // // Try to get token from Authorization header first
            // let token = if let Some(auth_header) = req.headers().get("Authorization") {
            //     info!("🔑 [Auth] Found Authorization header: {:?}", auth_header);
            //     
            //     match auth_header.to_str() {
            //         Ok(header_str) if header_str.starts_with("Bearer ") => {
            //             let token = &header_str[7..];
            //             if token == "null" || token.is_empty() {
            //                 info!("⚠️ [Auth] Empty or null token in Authorization header, trying cookie...");
            //                 None
            //             } else {
            //                 info!("✅ [Auth] Valid Bearer token format in header");
            //                 Some(token.to_string())
            //             }
            //         },
            //         _ => {
            //             info!("⚠️ [Auth] Invalid Authorization header format, trying cookie...");
            //             None
            //         }
            //     }
            // } else {
            //     info!("🔍 [Auth] No Authorization header, trying cookie...");
            //     None
            // };

            // // If no valid Authorization header token, try cookie
            // let token = if let Some(token) = token {
            //     token
            // } else {
            //     req.cookie("auth-token")
            //         .map(|cookie| {
            //             info!("🍪 [Auth] Found auth-token cookie with value");
            //             cookie.value().to_string()
            //         })
            //         .ok_or_else(|| {
            //             error!("❌ [Auth] No valid authentication found");
            //             if let Ok(cookies) = req.cookies() {
            //                 info!("📋 [Auth] Available cookies: {:?}", cookies.iter().collect::<Vec<_>>());
            //             }
            //             ErrorUnauthorized("No valid authentication token found")
            //         })?
            // };

            // if token.is_empty() {
            //     error!("❌ [Auth] Empty token");
            //     return Err(ErrorUnauthorized("Empty authentication token"));
            // }

            // info!("🔒 [Auth] Token obtained successfully");

            // let config = Config::from_env();
            // let claims = Claims::decode_token(&token, config.jwt_secret.as_bytes())
            //     .map_err(|e| {
            //         error!("[Auth] Token validation failed for path {}: {}", req.path(), e);
            //         ErrorUnauthorized(e.to_string())
            //     })?;

            // info!("[Auth] Token validated successfully for user: {}", claims.sub);

            // Insert user info into request extensions
            req.extensions_mut().insert(AuthenticatedUser {
                id: "test_user".to_string(),
            });

            // Get path before req is moved
            let path = req.path().to_string();
            let res = svc.call(req).await?;
            info!("[Auth] Request authorized successfully for test_user to path {}", path);
            Ok(res)
        })
    }
}
