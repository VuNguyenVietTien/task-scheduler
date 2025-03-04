use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::auth::types::Claims;
use crate::config::{JWT_EXPIRY, JWT_SECRET};

pub fn create_token(
    user_id: Uuid,
    email: String, 
    display_name: String,
) -> Result<(String, i64), AuthError> {
    let jwt_expiry = *JWT_EXPIRY;
    let expiration = Utc::now()
        .checked_add_signed(Duration::seconds(jwt_expiry))
        .ok_or_else(|| AuthError::TokenCreation("Token expiration error".into()))?
        .timestamp();

    let claims = Claims::new(
        user_id.to_string(),
        email,
        display_name,
        Duration::seconds(jwt_expiry),
    );

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok((token, expiration))
}

pub fn verify_token(token: &str) -> Result<Claims, AuthError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| AuthError::TokenVerification(e.to_string()))?;

    Ok(token_data.claims)
}

pub fn extend_token(token: &str, duration: Duration) -> Result<(String, i64), AuthError> {
    let mut claims = verify_token(token)?;
    
    // Calculate new expiration time
    let new_exp = Utc::now()
        .checked_add_signed(duration)
        .ok_or_else(|| AuthError::TokenCreation("Token expiration error".into()))?
        .timestamp();
    
    claims.exp = new_exp;

    let new_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok((new_token, new_exp))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_creation_and_verification() {
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let display_name = "Test User".to_string();

        let (token, _) = create_token(user_id, email.clone(), display_name.clone())
            .expect("Token creation should succeed");

        let claims = verify_token(&token).expect("Token verification should succeed");
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.email, email);
        assert_eq!(claims.display_name, display_name);
    }

    #[test]
    fn test_token_extension() {
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let display_name = "Test User".to_string();
        let duration = Duration::hours(1);

        let (token, exp) = create_token(user_id, email.clone(), display_name.clone())
            .expect("Token creation should succeed");

        let (new_token, new_exp) = extend_token(&token, duration)
            .expect("Token extension should succeed");

        assert_ne!(token, new_token);
        assert!(new_exp > exp);

        let claims = verify_token(&new_token).expect("Token verification should succeed");
        assert_eq!(claims.exp, new_exp);
    }
}
