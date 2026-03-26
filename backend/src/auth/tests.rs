#[cfg(test)]
mod tests {
    use crate::auth::{AuthService, AuthError};
    use crate::email::EmailServiceTrait;
    use async_trait::async_trait;
    use chrono::Utc;
    use uuid::Uuid;

    #[derive(Clone)]
    struct MockEmailService {}

    #[async_trait]
    impl EmailServiceTrait for MockEmailService {
        async fn send_verification_email(
            &self,
            _email: String,
            _token: String,
            _frontend_url: String,
        ) -> Result<(), Box<dyn std::error::Error>> {
            Ok(())
        }

        async fn send_password_reset(
            &self,
            _email: String,
            _token: String,
            _frontend_url: String,
        ) -> Result<(), Box<dyn std::error::Error>> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_register_user() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![], // No existing user
                vec![super::UserModel {
                    id: Uuid::new_v4(),
                    email: "test@example.com".to_string(),
                    password_hash: "hash".to_string(),
                    name: "Test User".to_string(),
                    role: "USER".to_string(),
                    email_verified: false,
                    verification_token: Some("token".to_string()),
                    verification_token_expires: Some(Utc::now().into()),
                    created_at: Utc::now().into(),
                    updated_at: Utc::now().into(),
                    firebase_uid: "".to_string(),
                    work_capacity: Some(40.0),
                    reset_token: None,
                    reset_token_expires: None,
                }],
            ])
            .into_connection();

        let email_service = MockEmailService {};
        
        let service = AuthService::new(
            db,
            b"test_secret".to_vec(),
            email_service,
            "http://localhost:3000".to_string(),
        );

        let result = service.register_user(
            "test@example.com".to_string(),
            "password123".to_string(),
            "Test User".to_string(),
        ).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_login_success() {
        let user_id = Uuid::new_v4();
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![super::UserModel {
                    id: user_id,
                    email: "test@example.com".to_string(),
                    password_hash: "$2b$12$LQBGTKxjJEnF9XrUkHGQK.4P5xCz6RSN8.GhvNr/H2xn0Q9kq5Dba".to_string(), // hash for "password123"
                    name: "Test User".to_string(),
                    role: "USER".to_string(),
                    email_verified: true,
                    verification_token: None,
                    verification_token_expires: None,
                    created_at: Utc::now().into(),
                    updated_at: Utc::now().into(),
                    firebase_uid: "".to_string(),
                    work_capacity: Some(40.0),
                    reset_token: None,
                    reset_token_expires: None,
                }],
            ])
            .into_connection();

        let email_service = MockEmailService {};
        
        let service = AuthService::new(
            db,
            b"test_secret".to_vec(),
            email_service,
            "http://localhost:3000".to_string(),
        );

        let result = service.login(
            "test@example.com".to_string(),
            "password123".to_string(),
        ).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_login_invalid_password() {
        let user_id = Uuid::new_v4();
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![super::UserModel {
                    id: user_id,
                    email: "test@example.com".to_string(),
                    password_hash: "$2b$12$different_hash".to_string(),
                    name: "Test User".to_string(),
                    role: "USER".to_string(),
                    email_verified: true,
                    verification_token: None,
                    verification_token_expires: None,
                    created_at: Utc::now().into(),
                    updated_at: Utc::now().into(),
                    firebase_uid: "".to_string(),
                    work_capacity: Some(40.0),
                    reset_token: None,
                    reset_token_expires: None,
                }],
            ])
            .into_connection();

        let email_service = MockEmailService {};
        
        let service = AuthService::new(
            db,
            b"test_secret".to_vec(),
            email_service,
            "http://localhost:3000".to_string(),
        );

        let result = service.login(
            "test@example.com".to_string(),
            "wrong_password".to_string(),
        ).await;

        assert!(matches!(result, Err(AuthError::InvalidPassword)));
    }
}