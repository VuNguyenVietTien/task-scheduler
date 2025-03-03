use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::config::Config;
use super::jwt::{Claims, create_token, verify_token};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AuthUser {
    pub fn is_admin(&self) -> bool {
        self.role == "admin"
    }

    pub fn can_manage_project(&self) -> bool {
        self.is_admin()
    }

    pub fn can_manage_task(&self, task_creator_id: Uuid) -> bool {
        self.is_admin() || self.id == task_creator_id
    }

    pub fn can_manage_comment(&self, comment_creator_id: Uuid) -> bool {
        self.is_admin() || self.id == comment_creator_id
    }

    pub fn can_assign_task(&self, project_creator_id: Uuid) -> bool {
        self.is_admin() || self.id == project_creator_id
    }

    pub fn create_token(&self, config: &Config) -> Result<String, jsonwebtoken::errors::Error> {
        create_token(
            self.id,
            &self.email,
            &self.name,
            &self.role,
            config,
        )
    }

    pub fn from_claims(claims: Claims, created_at: DateTime<Utc>, updated_at: DateTime<Utc>) -> Self {
        Self {
            id: claims.sub,
            email: claims.email,
            name: claims.name,
            role: claims.role,
            created_at,
            updated_at,
        }
    }
}

pub fn authorize_user(token: &str, config: &Config) -> Result<AuthUser, crate::error::AppError> {
    let claims = verify_token(token, config)?;
    
    // For now, use current time for created_at and updated_at
    // In real app, these would come from the database
    let now = Utc::now();
    
    Ok(AuthUser::from_claims(claims, now, now))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_user_permissions() {
        let admin = AuthUser {
            id: Uuid::new_v4(),
            email: "admin@example.com".to_string(),
            name: "Admin".to_string(),
            role: "admin".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let user = AuthUser {
            id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            name: "User".to_string(),
            role: "user".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(admin.is_admin());
        assert!(admin.can_manage_project());
        assert!(admin.can_manage_task(user.id));
        assert!(admin.can_manage_comment(user.id));
        assert!(admin.can_assign_task(user.id));

        assert!(!user.is_admin());
        assert!(!user.can_manage_project());
        assert!(!user.can_manage_task(admin.id));
        assert!(user.can_manage_task(user.id));
        assert!(!user.can_manage_comment(admin.id));
        assert!(user.can_manage_comment(user.id));
        assert!(!user.can_assign_task(admin.id));
        assert!(user.can_assign_task(user.id));
    }
}