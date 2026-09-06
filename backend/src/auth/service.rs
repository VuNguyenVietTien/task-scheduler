use crate::{
    auth::{auth_common, error::AuthError, password},
    config::Config,
    graphql::types::User,
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct AuthService {
    db: PgPool,
}

impl AuthService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn register(
        &self,
        email: String,
        password: String,
        username: String,
    ) -> Result<(String, String, User), AuthError> {
        // Check if email exists
        let exists = sqlx::query("SELECT user_id FROM users WHERE email = $1")
            .bind(&email)
            .fetch_optional(&self.db)
            .await?;

        if exists.is_some() {
            return Err(AuthError::EmailExists);
        }

        let user_id = Uuid::new_v4();

        // Hash password
        let password_hash =
            password::hash(password).map_err(|e| AuthError::Other(e.to_string()))?;

        // Insert new user with a collision-safe username (F1):
        // `username` is UNIQUE in the schema, so on 23505 retry with a
        // timestamp-suffixed candidate, then re-select by email (concurrent
        // registration) before giving up.
        let mut inserted_username: Option<String> = None;
        for candidate in username_candidates(&username, &email) {
            match sqlx::query(
                "INSERT INTO users (user_id, email, password_hash, username)
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(user_id)
            .bind(&email)
            .bind(&password_hash)
            .bind(&candidate)
            .execute(&self.db)
            .await
            {
                Ok(_) => {
                    inserted_username = Some(candidate);
                    break;
                }
                Err(e) if is_unique_violation(&e) => continue,
                Err(e) => return Err(e.into()),
            }
        }

        let username = match inserted_username {
            Some(u) => u,
            None => {
                // Every candidate collided — either a same-email race or a very
                // unlucky username. Mirror the web fallback: re-select by email.
                let row = sqlx::query(
                    "SELECT user_id, email, username, full_name, avatar_url \
                     FROM users WHERE email = $1",
                )
                .bind(&email)
                .fetch_optional(&self.db)
                .await?;
                if let Some(row) = row {
                    let user = row_to_user(row);
                    let config = Config::from_env().map_err(|e| AuthError::Other(e.to_string()))?;
                    let token = auth_common::create_token(
                        user.user_id,
                        user.email.clone(),
                        user.username.clone().unwrap_or_default(),
                        &config,
                    )?;
                    return Ok((token.clone(), token, user));
                }
                return Err(AuthError::Database(sqlx::Error::RowNotFound));
            }
        };

        // Create tokens
        let config = Config::from_env().map_err(|e| AuthError::Other(e.to_string()))?;

        let token = auth_common::create_token(user_id, email.clone(), username.clone(), &config)?;

        let user = User {
            user_id: user_id,
            email,
            username: Some(username),
            full_name: None,
            avatar_url: None,
        };

        Ok((token.clone(), token, user))
    }

    /// Upsert used by REST auth parity (`/firebase/login`). Resolution order
    /// (uid-first, then email — better than the web route, binds existing
    /// Firebase accounts correctly):
    /// 1. existing row by `firebase_uid` (legacy mobile users), else
    /// 2. existing row by `email` (web users whose Supabase UUID differs), else
    /// 3. insert a new app row with a collision-safe username.
    /// Returns the user plus `true` when a row was created.
    pub async fn upsert_user_by_email(
        &self,
        email: String,
        name: String,
        firebase_uid: String,
    ) -> Result<(User, bool), AuthError> {
        const SELECT_COLS: &str =
            "SELECT user_id, email, username, full_name, avatar_url FROM users ";

        if let Some(row) = sqlx::query(&format!("{}WHERE firebase_uid = $1", SELECT_COLS))
            .bind(&firebase_uid)
            .fetch_optional(&self.db)
            .await?
        {
            return Ok((row_to_user(row), false));
        }

        if let Some(row) = sqlx::query(&format!("{}WHERE email = $1", SELECT_COLS))
            .bind(&email)
            .fetch_optional(&self.db)
            .await?
        {
            return Ok((row_to_user(row), false));
        }

        let user_id = Uuid::new_v4();
        // Collision-safe username insert (F1): `username` is UNIQUE; a display
        // name or email local part can collide across accounts (john@gmail.com /
        // john@outlook.com → "john"), which previously 500'd on 23505. Retry
        // with a sanitized base + timestamp suffix, then re-select by email
        // (concurrent insert), mirroring the web `firebase/login` route.
        let mut inserted_username: Option<String> = None;
        for candidate in username_candidates(&name, &email) {
            match sqlx::query(
                "INSERT INTO users (user_id, email, username, firebase_uid)
                 VALUES ($1, $2, $3, $4)",
            )
            .bind(user_id)
            .bind(&email)
            .bind(&candidate)
            .bind(&firebase_uid)
            .execute(&self.db)
            .await
            {
                Ok(_) => {
                    inserted_username = Some(candidate);
                    break;
                }
                Err(e) if is_unique_violation(&e) => continue,
                Err(e) => return Err(e.into()),
            }
        }

        if inserted_username.is_none() {
            // All candidates collided — most likely a concurrent insert for the
            // same email. Mirror the web fallback: select the existing row.
            if let Some(row) = sqlx::query(&format!("{}WHERE email = $1", SELECT_COLS))
                .bind(&email)
                .fetch_optional(&self.db)
                .await?
            {
                return Ok((row_to_user(row), false));
            }
            return Err(AuthError::Database(sqlx::Error::RowNotFound));
        }

        Ok((
            User {
                user_id,
                email,
                username: inserted_username,
                full_name: None,
                avatar_url: None,
            },
            true,
        ))
    }

    pub async fn register_firebase_user(
        &self,
        email: String,
        name: String,
        firebase_uid: String,
    ) -> Result<(String, String, User), AuthError> {
        let (user, _created) = self.upsert_user_by_email(email, name, firebase_uid).await?;

        let username = user.username.clone();

        // Create JWT token
        let config = Config::from_env().map_err(|e| AuthError::Other(e.to_string()))?;

        let token = auth_common::create_token(
            user.user_id,
            user.email.clone(),
            username.unwrap_or_default(),
            &config,
        )?;

        Ok((token.clone(), token, user))
    }

    pub async fn login(&self, email: String, password: String) -> Result<User, AuthError> {
        // Update query to include the name column
        let row = sqlx::query(
            "SELECT user_id, email, username, password_hash 
             FROM users 
             WHERE email = $1",
        )
        .bind(&email)
        .fetch_optional(&self.db)
        .await?
        .ok_or(AuthError::InvalidCredentials)?;

        let stored_hash: String = row.get("password_hash");

        // Verify password
        if !password::verify_password(&password, &stored_hash)
            .map_err(|e| AuthError::Other(e.to_string()))?
        {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(User {
            user_id: row.get("user_id"),
            email: row.get("email"),
            username: row.get("username"),
            full_name: None,
            avatar_url: None,
        })
    }

    pub async fn verify_email(&self, token: String) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn request_password_reset(&self, email: String) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn reset_password(
        &self,
        token: String,
        new_password: String,
    ) -> Result<(), AuthError> {
        Ok(())
    }

    pub async fn change_password(
        &self,
        user_id: Uuid,
        old_password: String,
        new_password: String,
    ) -> Result<(), AuthError> {
        Ok(())
    }
}

/// Map a `users` row (user_id, email, username, full_name, avatar_url) to the
/// GraphQL `User` response type shared by the auth service.
fn row_to_user(row: sqlx::postgres::PgRow) -> crate::graphql::types::User {
    use sqlx::Row;
    User {
        user_id: row.get("user_id"),
        email: row.get("email"),
        username: row.get("username"),
        full_name: row.get("full_name"),
        avatar_url: row.get("avatar_url"),
    }
}

/// Sanitized username base from a preferred name or an email local part,
/// mirroring the web route: `email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')`.
/// Falls back to "user" when nothing usable remains.
pub fn sanitize_username_base(input: &str) -> String {
    let mapped: String = input
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = mapped.trim_matches('_');
    if trimmed.is_empty() {
        "user".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Bounded username candidates for collision-safe inserts (F1):
/// 1. the sanitized preferred value,
/// 2. the same base with a millisecond-timestamp suffix (web parity retry).
pub fn username_candidates(preferred: &str, email: &str) -> Vec<String> {
    let base = {
        let preferred = sanitize_username_base(preferred);
        if preferred != "user" && !preferred.is_empty() {
            preferred
        } else {
            sanitize_username_base(&crate::auth::identity::email_local_part(email))
        }
    };
    vec![
        base.clone(),
        format!("{}_{}", base, chrono::Utc::now().timestamp_millis()),
    ]
}

/// True when the sqlx error is a Postgres unique-constraint violation (23505).
fn is_unique_violation(err: &sqlx::Error) -> bool {
    matches!(err, sqlx::Error::Database(db) if db.code().as_deref() == Some("23505"))
}

#[cfg(test)]
mod service_tests {
    use super::*;

    #[test]
    fn sanitize_strips_non_alnum_and_collapses_empty() {
        assert_eq!(sanitize_username_base("john.doe"), "john_doe");
        assert_eq!(sanitize_username_base("Nguyễn Văn"), "Nguy_n_V_n");
        assert_eq!(sanitize_username_base("!!!"), "user");
        assert_eq!(sanitize_username_base(""), "user");
    }

    #[test]
    fn username_candidates_are_bounded_and_suffixed() {
        let c1 = username_candidates("Jane Doe", "jane@x.com");
        assert_eq!(c1.len(), 2);
        assert_eq!(c1[0], "Jane_Doe");
        assert!(
            c1[1].starts_with("Jane_Doe_"),
            "second candidate must be suffixed: {}",
            c1[1]
        );

        // Preferred name unusable → base falls back to sanitized email local part
        let c2 = username_candidates("   ", "john.doe@gmail.com");
        assert_eq!(c2[0], "john_doe");

        // Email-local-part collision case from the review (john@gmail vs john@outlook)
        let c3 = username_candidates("john", "john@outlook.com");
        assert_eq!(c3[0], "john");
        assert!(c3[1].starts_with("john_"));
    }

    #[test]
    fn unique_violation_detection() {
        let not_violation = sqlx::Error::RowNotFound;
        assert!(!is_unique_violation(&not_violation));
    }
}
