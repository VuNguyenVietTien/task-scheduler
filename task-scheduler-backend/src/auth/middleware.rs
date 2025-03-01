use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
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
            let auth_header = req
                .headers()
                .get("Authorization")
                .ok_or_else(|| ErrorUnauthorized("No authorization header"))?;

            let auth_str = auth_header
                .to_str()
                .map_err(|_| ErrorUnauthorized("Invalid authorization header"))?;

            if !auth_str.starts_with("Bearer ") {
                return Err(ErrorUnauthorized("Invalid authorization scheme"));
            }

            let token = &auth_str["Bearer ".len()..];

            let config = Config::from_env();
            let claims = Claims::decode_token(token, config.jwt_secret.as_bytes())
                .map_err(|e| ErrorUnauthorized(e.to_string()))?;

            // Insert user info into request extensions
            req.extensions_mut().insert(AuthenticatedUser {
                id: claims.sub,
            });

            let res = svc.call(req).await?;
            Ok(res)
        })
    }
}
