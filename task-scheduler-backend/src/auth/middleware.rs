use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse},
    Error,
};
use futures::future::LocalBoxFuture;

use actix_web::{
    error::ErrorUnauthorized,
    http::header::{HeaderMap, AUTHORIZATION},
};
use actix_web_httpauth::extractors::bearer::BearerAuth;

use crate::auth::token::verify_access_token;
use crate::config::Config;

pub async fn validator(
    req: ServiceRequest,
    credentials: BearerAuth,
    config: &Config,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let token = credentials.token();
    
    // Verify token
    match verify_access_token(token, config) {
        Ok(_) => Ok(req),
        Err(e) => Err((ErrorUnauthorized(e.to_string()), req)),
    }
}

pub fn extract_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")?
        .to_string()
        .into()
}

pub struct AuthMiddleware<S> {
    service: S,
}

impl<S> AuthMiddleware<S> {
    pub fn new(service: S) -> Self {
        Self { service }
    }
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let auth_header = req.headers().get("Authorization");
        
        if let Some(auth_header) = auth_header {
            if let Ok(auth_str) = auth_header.to_str() {
                if auth_str.starts_with("Bearer ") {
                    let token = auth_str.trim_start_matches("Bearer ").trim();
                    
                    match verify_access_token(token, &Config::from_env().unwrap()) {
                        Ok(_) => {
                            let fut = self.service.call(req);
                            return Box::pin(async move {
                                let res = fut.await?;
                                Ok(res)
                            });
                        }
                        Err(_) => {
                            return Box::pin(async move {
                                Err(actix_web::error::ErrorUnauthorized("Invalid token"))
                            });
                        }
                    }
                }
            }
        }

        Box::pin(async move {
            Err(actix_web::error::ErrorUnauthorized("Missing or invalid authorization"))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test;
    use actix_web::http::header::HeaderValue;

    #[actix_rt::test]
    async fn test_extract_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer test-token"),
        );

        let token = extract_token(&headers);
        assert_eq!(token, Some("test-token".to_string()));
    }

    #[actix_rt::test]
    async fn test_extract_token_no_auth_header() {
        let headers = HeaderMap::new();
        let token = extract_token(&headers);
        assert_eq!(token, None);
    }

    #[actix_rt::test]
    async fn test_extract_token_invalid_format() {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_static("Invalid-token"));

        let token = extract_token(&headers);
        assert_eq!(token, None);
    }
}
