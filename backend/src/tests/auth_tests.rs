use super::helpers::*;
use crate::{
    auth::{Auth, AuthUser},
    config::Config,
    db::entities::user::{self, UserRole},
};
use chrono::{Duration, Utc};
use uuid::Uuid;

#[tokio::test]
async fn test_user_registration() {
    let db = setup_test_db().await;
    let email = "test@example.com";
    let password = "password123";
    let name = "Test User";

    // Hash password
    let password_hash = Auth::hash_password(password).unwrap();
    
    let user = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(email.to_string()),
        name: Set(name.to_string()),
        password_hash: Set(password_hash),
        role: Set(UserRole::Member.to_string()),
        work_capacity: Set(1.0),
        created_at: Set(Utc::now().into()),
        updated_at: Set(Utc::now().into()),
    };

    let result = user.insert(&db).await;
    assert!(result.is_ok());

    let created_user = result.unwrap();
    assert_eq!(created_user.email, email);
    assert_eq!(created_user.name, name);
}

#[tokio::test]
async fn test_password_validation() {
    let password = "password123";
    let hash = Auth::hash_password(password).unwrap();
    
    // Test valid password
    let is_valid = Auth::verify_password(password, &hash).unwrap();
    assert!(is_valid);

    // Test invalid password
    let is_valid = Auth::verify_password("wrongpassword", &hash).unwrap();
    assert!(!is_valid);
}

#[tokio::test]
async fn test_token_generation_and_validation() {
    let config = Config::default();
    let user = user::Model {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        name: "Test User".to_string(),
        password_hash: "hash".to_string(),
        role: UserRole::Member.to_string(),
        work_capacity: 1.0,
        created_at: Utc::now().into(),
        updated_at: Utc::now().into(),
    };

    let tokens = Auth::create_tokens(&user, &config).unwrap();
    assert!(!tokens.access_token.is_empty());
    assert!(!tokens.refresh_token.is_empty());

    // Verify access token
    let auth_user = Auth::verify_token(&tokens.access_token, &config).unwrap();
    assert_eq!(auth_user.id, user.id);
    assert_eq!(auth_user.email, user.email);
    assert_eq!(auth_user.role, user.role);
}

#[tokio::test]
async fn test_token_expiration() {
    let mut config = Config::default();
    config.jwt_secret = "test-secret".to_string();

    let user = user::Model {
        id: Uuid::new_v4(),
        email: "test@example.com".to_string(),
        name: "Test User".to_string(),
        password_hash: "hash".to_string(),
        role: UserRole::Member.to_string(),
        work_capacity: 1.0,
        created_at: Utc::now().into(),
        updated_at: Utc::now().into(),
    };

    let expired_user = AuthUser {
        id: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: (Utc::now() - Duration::hours(1)).timestamp(), // Expired 1 hour ago
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &expired_user,
        &jsonwebtoken::EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .unwrap();

    let result = Auth::verify_token(&token, &config);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_role_permissions() {
    // Test admin permissions
    let admin = AuthUser {
        id: Uuid::new_v4(),
        email: "admin@example.com".to_string(),
        role: UserRole::Admin.to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp(),
    };

    assert!(admin.is_admin());
    assert!(admin.can_manage_users());
    assert!(admin.can_manage_project());

    // Test manager permissions
    let manager = AuthUser {
        id: Uuid::new_v4(),
        email: "manager@example.com".to_string(),
        role: UserRole::Manager.to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp(),
    };

    assert!(!manager.is_admin());
    assert!(!manager.can_manage_users());
    assert!(manager.can_manage_project());

    // Test regular member permissions
    let member = AuthUser {
        id: Uuid::new_v4(),
        email: "member@example.com".to_string(),
        role: UserRole::Member.to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp(),
    };

    assert!(!member.is_admin());
    assert!(!member.can_manage_users());
    assert!(!member.can_manage_project());
}

#[tokio::test]
async fn test_invalid_token() {
    let config = Config::default();
    let result = Auth::verify_token("invalid-token", &config);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_unique_email_constraint() {
    let db = setup_test_db().await;
    let email = "test@example.com";

    // Create first user
    let user1 = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(email.to_string()),
        name: Set("Test User 1".to_string()),
        password_hash: Set("hash1".to_string()),
        role: Set(UserRole::Member.to_string()),
        work_capacity: Set(1.0),
        created_at: Set(Utc::now().into()),
        updated_at: Set(Utc::now().into()),
    };

    let result1 = user1.insert(&db).await;
    assert!(result1.is_ok());

    // Try to create second user with same email
    let user2 = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(email.to_string()),
        name: Set("Test User 2".to_string()),
        password_hash: Set("hash2".to_string()),
        role: Set(UserRole::Member.to_string()),
        work_capacity: Set(1.0),
        created_at: Set(Utc::now().into()),
        updated_at: Set(Utc::now().into()),
    };

    let result2 = user2.insert(&db).await;
    assert!(result2.is_err());
}
