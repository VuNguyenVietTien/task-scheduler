use actix_web::HttpRequest;
use crate::auth::jwt::{Claims, verify_token};

pub fn extract_claims(req: &HttpRequest, jwt_secret: &str) -> Option<Claims> {
    let auth_header = req.headers().get("Authorization")?;
    let auth_str = auth_header.to_str().ok()?;
    let token = auth_str.strip_prefix("Bearer ")?;
    verify_token(token, jwt_secret).ok()
}
