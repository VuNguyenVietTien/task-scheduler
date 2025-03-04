use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

use crate::auth::error::AuthError;
use crate::auth::types::Claims;
use crate::config::{JWT_EXPIRY, JWT_SECRET};

pub fn create_token(claims: Claims) -> Result<(String, i64), AuthError> {
    let jwt_expiry = *JWT_EXPIRY;
    let expiration = Utc::now()
        .checked_add_signed(Duration::seconds(jwt_expiry))
        .ok_or_else(|| AuthError::TokenCreation("Failed to create token expiration".into()))?
        .timestamp();

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

    let claims = token_data.claims;
    
    // Check if token is expired
    if claims.is_expired() {
        return Err(AuthError::TokenExpired);
    }

    Ok(claims)
}

pub fn refresh_token(claims: Claims) -> Result<(String, i64), AuthError> {
    // Create new token with extended expiration
    let jwt_expiry = *JWT_EXPIRY;
    let new_expiration = Utc::now()
        .checked_add_signed(Duration::seconds(jwt_expiry))
        .ok_or_else(|| AuthError::TokenCreation("Failed to create token expiration".into()))?
        .timestamp();

    let new_claims = Claims {
        exp: new_expiration,
        iat: Utc::now().timestamp(),
        ..claims
    };

    let token = encode(
        &Header::default(),
        &new_claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| AuthError::TokenCreation(e.to_string()))?;

    Ok((token, new_expiration))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_jwt_flow() {
        let user_id = Uuid::new_v4().to_string();
        let claims = Claims::new(
            user_id.clone(),
            "test@example.com".to_string(),
            "Test User".to_string(),
            Duration::hours(1),
        );

        // Test token creation
        let (token, exp) = create_token(claims.clone()).unwrap();
        assert!(!token.is_empty());
        assert!(exp > Utc::now().timestamp());

        // Test token verification
        let verified_claims = verify_token(&token).unwrap();
        assert_eq!(verified_claims.sub, user_id);
        assert_eq!(verified_claims.exp, exp);

        // Test token refresh
        let (new_token, new_exp) = refresh_token(verified_claims).unwrap();
        assert_ne!(token, new_token);
        assert!(new_exp > exp);

        // Verify refreshed token
        let new_claims = verify_token(&new_token).unwrap();
        assert_eq!(new_claims.sub, user_id);
        assert_eq!(new_claims.exp, new_exp);
    }

    #[test]
    fn test_expired_token() {
        let mut claims = Claims::new(
            Uuid::new_v4().to_string(),
            "test@example.com".to_string(),
            "Test User".to_string(),
            Duration::hours(1),
        );

        // Set expiration in the past
        claims.exp = Utc::now().timestamp() - 3600; // 1 hour ago

        let (token, _) = create_token(claims).unwrap();
        let result = verify_token(&token);
        assert!(matches!(result, Err(AuthError::TokenExpired)));
    }
}