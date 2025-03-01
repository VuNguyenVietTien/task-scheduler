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

            // Check for auth token in cookies
            let token = req.cookie("auth-token")
                .ok_or_else(|| {
                    error!("[Auth] No auth-token cookie found for request to: {}", req.path());
                    // Safely handle cookies Result and log them
                    if let Ok(cookies) = req.cookies() {
                        let cookie_list: Vec<_> = cookies.iter().collect();
                        info!("[Auth] Available cookies: {:?}", cookie_list);
                    }
                    ErrorUnauthorized("Authentication required")
                })?
                .value()
                .to_string();

            info!("[Auth] Found auth-token cookie");

            let config = Config::from_env();
            let claims = Claims::decode_token(&token, config.jwt_secret.as_bytes())
                .map_err(|e| {
                    error!("[Auth] Token validation failed for path {}: {}", req.path(), e);
                    ErrorUnauthorized(e.to_string())
                })?;

            info!("[Auth] Token validated successfully for user: {}", claims.sub);

            // Insert user info into request extensions
            req.extensions_mut().insert(AuthenticatedUser {
                id: claims.sub,
            });

            // Get path before req is moved
            let path = req.path().to_string();
            let res = svc.call(req).await?;
            info!("[Auth] Request authorized successfully for user {} to path {}", claims.sub, path);
            Ok(res)
        })
    }
}
