use sqlx::PgPool;
use crate::auth::jwt::Claims;
use crate::config::Config;

pub struct GqlContext {
    pub pool: PgPool,
    pub claims: Option<Claims>,
    pub config: Config,
}

impl GqlContext {
    pub fn new(pool: PgPool, claims: Option<Claims>, config: Config) -> Self {
        Self { pool, claims, config }
    }

    pub fn require_auth(&self) -> Result<&Claims, crate::error::AppError> {
        self.claims.as_ref().ok_or(crate::error::AppError::Unauthorized("Authentication required".into()))
    }

    pub fn user_id(&self) -> Result<i64, crate::error::AppError> {
        let claims = self.require_auth()?;
        claims.sub.parse::<i64>().map_err(|_| {
            // Try parsing as UUID and converting
            crate::error::AppError::Unauthorized("Invalid user ID in token".into())
        })
    }
}
