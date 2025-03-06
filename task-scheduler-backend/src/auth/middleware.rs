use actix_web::{
    dev::ServiceRequest,
    error::ErrorUnauthorized,
    http::header::{HeaderMap, AUTHORIZATION},
    Error,
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
        Ok(_claims) => Ok(req),
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

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::http::header::HeaderValue;
    use actix_web::test;

    #[test]
    fn test_extract_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer test-token"),
        );

        let token = extract_token(&headers);
        assert_eq!(token, Some("test-token".to_string()));
    }

    #[test]
    fn test_extract_token_no_auth_header() {
        let headers = HeaderMap::new();
        let token = extract_token(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_token_invalid_format() {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_static("Invalid-token"));

        let token = extract_token(&headers);
        assert_eq!(token, None);
    }

    #[actix_rt::test]
    async fn test_validator_invalid_token() {
        let config = Config {
            database_url: "".to_string(),
            redis_url: "".to_string(),
            server_host: "".to_string(),
            server_port: 8080,
            auth_secret: "test-auth-secret".to_string(),
            jwt_secret: "test-jwt-secret".to_string(),
            jwt_expiry: 3600,
            email_from: "".to_string(),
            email_smtp_host: "".to_string(),
            email_smtp_port: 587,
            email_smtp_user: "".to_string(),
            email_smtp_pass: "".to_string(),
        };

        let req = test::TestRequest::default().to_srv_request();
        let credentials = BearerAuth::new("invalid-token".to_string());

        let result = validator(req, credentials, &config).await;
        assert!(result.is_err());
    }
}
