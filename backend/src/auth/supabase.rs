//! Supabase auth integration (Phase 2, W1b).
//!
//! Three concerns:
//! 1. `verify_supabase_token` — verify a Supabase access token (JWT, HS256) with the
//!    real `SUPABASE_JWT_SECRET` env value. Tokens are NEVER decoded without
//!    verification; when the secret is missing we reject with a clear log message
//!    (callers then fall back to the backend's own JWT so existing mobile apps keep
//!    working).
//! 2. `resolve_supabase_identity` — map a Supabase `auth.users` UUID to the app
//!    `users.user_id` by email, mirroring `web/src/lib/graphql/context.ts`
//!    (`appUser?.user_id ?? authUser.id` fallback included).
//! 3. `SupabaseAdminClient` — thin wrapper over the Supabase Auth Admin API
//!    (`/auth/v1/admin/users`, `/auth/v1/admin/generate_link`) driven by
//!    `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. No secrets are hardcoded.

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::auth::error::AuthError;
use crate::config::Config;

pub const SUPABASE_JWT_SECRET_ENV: &str = "SUPABASE_JWT_SECRET";

/// Claims carried by a Supabase access token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseClaims {
    /// Supabase `auth.users` UUID — NOT the app `users.user_id` FK.
    pub sub: String,
    pub email: Option<String>,
    pub exp: i64,
    #[serde(default)]
    pub iat: Option<i64>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub aud: Option<Value>,
}

/// Identity of an authenticated Supabase user, after resolving the app row.
#[derive(Debug, Clone)]
pub struct SupabaseIdentity {
    /// Supabase `auth.users` UUID (from the JWT `sub`).
    pub auth_user_id: String,
    pub email: String,
    pub name: Option<String>,
    /// App `users.user_id` resolved by email. `None` when no app row exists yet —
    /// consumers must then fall back to `auth_user_id` (web parity).
    pub app_user_id: Option<Uuid>,
}

/// Verify a Supabase access token (HS256) with `SUPABASE_JWT_SECRET`.
///
/// - Missing env => `AuthError::Unauthorized` with a clear message (reject + log).
/// - Wrong/alg-confused/expired tokens => token errors, caller falls back to own JWT.
pub fn verify_supabase_token(token: &str, config: &Config) -> Result<SupabaseClaims, AuthError> {
    let secret = config.supabase_jwt_secret.trim();
    if secret.is_empty() {
        return Err(AuthError::Unauthorized(format!(
            "Supabase token received but {} is not configured — rejecting (set it to enable Supabase auth)",
            SUPABASE_JWT_SECRET_ENV
        )));
    }

    let header = decode_header(token)
        .map_err(|e| AuthError::InvalidToken(format!("Supabase token header invalid: {}", e)))?;
    if header.alg != Algorithm::HS256 {
        return Err(AuthError::InvalidToken(format!(
            "Supabase token must use HS256, got {:?}",
            header.alg
        )));
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    decode::<SupabaseClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
        _ => AuthError::TokenVerification(format!("Supabase token verification failed: {}", e)),
    })
}

/// Resolve the app `users` row for a verified Supabase token, by email.
///
/// Mirrors `web/src/lib/graphql/context.ts`: `users.user_id` (app FK) is looked up
/// by email; when missing, callers fall back to the Supabase auth UUID.
pub async fn resolve_supabase_identity(claims: &SupabaseClaims, db: &PgPool) -> SupabaseIdentity {
    let email = claims.email.clone().unwrap_or_default();
    let mut identity = SupabaseIdentity {
        auth_user_id: claims.sub.clone(),
        email,
        name: None,
        app_user_id: None,
    };

    if identity.email.is_empty() {
        return identity;
    }

    match sqlx::query("SELECT user_id, name FROM users WHERE email = $1 LIMIT 1")
        .bind(&identity.email)
        .fetch_optional(db)
        .await
    {
        Ok(Some(row)) => {
            identity.app_user_id = Some(row.get::<Uuid, _>("user_id"));
            identity.name = row.try_get::<Option<String>, _>("name").ok().flatten();
        }
        Ok(None) => {
            eprintln!(
                "[Supabase] No app users row for email '{}' — falling back to Supabase auth UUID (web parity)",
                identity.email
            );
        }
        Err(e) => {
            eprintln!(
                "[Supabase] Failed to resolve app user by email '{}': {}",
                identity.email, e
            );
        }
    }

    identity
}

/// Thin client for the Supabase Auth Admin API (service role key).
pub struct SupabaseAdminClient {
    base_url: String,
    service_role_key: String,
    http: reqwest::Client,
}

impl std::fmt::Debug for SupabaseAdminClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SupabaseAdminClient")
            .field("base_url", &self.base_url)
            .field("service_role_key", &"***")
            .finish()
    }
}

impl SupabaseAdminClient {
    /// Build from config. Fails with a clear error when `SUPABASE_URL` /
    /// `SUPABASE_SERVICE_ROLE_KEY` are missing — never with a panic.
    pub fn from_config(config: &Config) -> Result<Self, AuthError> {
        let base_url = config.supabase_url.trim().trim_end_matches('/').to_string();
        let key = config.supabase_service_role_key.trim().to_string();
        if base_url.is_empty() || key.is_empty() {
            return Err(AuthError::Unauthorized(
                "Supabase Admin API is not configured on the backend: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY".to_string(),
            ));
        }
        Ok(Self {
            base_url,
            service_role_key: key,
            http: reqwest::Client::new(),
        })
    }

    async fn post_admin(&self, path: &str, body: Value) -> Result<Value, AuthError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .post(&url)
            .header("apikey", &self.service_role_key)
            .bearer_auth(&self.service_role_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                AuthError::Other(format!(
                    "Supabase Admin API request failed ({}): {}",
                    url, e
                ))
            })?;

        let status = resp.status();
        let payload: Value = resp.json().await.unwrap_or(Value::Null);

        if !status.is_success() {
            let msg = extract_supabase_error(&payload);
            return Err(AuthError::Other(format!(
                "Supabase Admin API {} returned {}: {}",
                path, status, msg
            )));
        }

        Ok(payload)
    }

    /// Admin `createUser`. `email_confirm` mirrors the web register/firebase flows.
    pub async fn create_user(
        &self,
        email: &str,
        password: Option<&str>,
        email_confirm: bool,
        user_metadata: Value,
    ) -> Result<Value, AuthError> {
        let mut body = json!({
            "email": email,
            "email_confirm": email_confirm,
            "user_metadata": user_metadata,
        });
        if let Some(pw) = password {
            body["password"] = Value::String(pw.to_string());
        }
        self.post_admin("/auth/v1/admin/users", body).await
    }

    /// Admin `generateLink` with `type: "magiclink"`; returns
    /// `{ properties: { action_link, email_otp, ... }, user: {...} }` — served to
    /// the web frontend as the `session` field of `/api/v1/auth/firebase/login`.
    pub async fn generate_magic_link(&self, email: &str) -> Result<Value, AuthError> {
        self.post_admin(
            "/auth/v1/admin/generate_link",
            json!({ "type": "magiclink", "email": email }),
        )
        .await
    }
}

fn extract_supabase_error(payload: &Value) -> String {
    payload
        .get("msg")
        .or_else(|| payload.get("error"))
        .or_else(|| payload.get("message"))
        .or_else(|| payload.get("error_description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| payload.to_string())
}

/// True when the Admin API error means "this email is already registered"
/// (Supabase returns 422 / msg "already exists…"). The web flow ignores it.
pub fn is_user_already_exists_error(err: &AuthError) -> bool {
    let msg = err.to_string();
    msg.contains("already exists")
        || msg.contains("already been registered")
        || msg.contains("A user with this email")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use jsonwebtoken::{encode, EncodingKey, Header};

    fn test_config(jwt_secret: &str) -> Config {
        Config {
            jwt_secret: "own-jwt-secret".to_string(),
            supabase_jwt_secret: jwt_secret.to_string(),
            ..Default::default()
        }
    }

    fn make_supabase_token(secret: &str, sub: &str, email: &str, expires_in: i64) -> String {
        let claims = json!({
            "sub": sub,
            "email": email,
            "exp": (Utc::now() + Duration::seconds(expires_in)).timestamp(),
            "iat": Utc::now().timestamp(),
            "role": "authenticated",
            "aud": "authenticated",
        });
        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap()
    }

    #[test]
    fn verifies_valid_supabase_token() {
        let config = test_config("supa-secret");
        let token = make_supabase_token(
            "supa-secret",
            "11111111-1111-1111-1111-111111111111",
            "a@b.c",
            3600,
        );

        let claims = verify_supabase_token(&token, &config).unwrap();
        assert_eq!(claims.sub, "11111111-1111-1111-1111-111111111111");
        assert_eq!(claims.email.as_deref(), Some("a@b.c"));
        assert_eq!(claims.role.as_deref(), Some("authenticated"));
    }

    #[test]
    fn rejects_token_signed_with_wrong_secret() {
        let config = test_config("supa-secret");
        let token = make_supabase_token("other-secret", "sub", "a@b.c", 3600);
        assert!(verify_supabase_token(&token, &config).is_err());
    }

    #[test]
    fn rejects_expired_token() {
        let config = test_config("supa-secret");
        let token = make_supabase_token("supa-secret", "sub", "a@b.c", -3600);
        match verify_supabase_token(&token, &config) {
            Err(AuthError::TokenExpired) => {}
            other => panic!("expected TokenExpired, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn rejects_when_secret_env_missing() {
        let config = test_config("");
        let token = make_supabase_token("supa-secret", "sub", "a@b.c", 3600);
        match verify_supabase_token(&token, &config) {
            Err(AuthError::Unauthorized(msg)) => {
                assert!(msg.contains(SUPABASE_JWT_SECRET_ENV), "msg: {}", msg);
            }
            other => panic!("expected Unauthorized, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn rejects_non_hs256_algorithm() {
        // Hand-crafted "alg: none" token — must be rejected before any signature work.
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine;
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"none","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(br#"{"sub":"x","email":"a@b.c","exp":9999999999}"#);
        let token = format!("{}.{}.", header, payload);

        let config = test_config("supa-secret");
        match verify_supabase_token(&token, &config) {
            Err(AuthError::InvalidToken(msg)) => assert!(msg.contains("HS256")),
            other => panic!("expected InvalidToken, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn malformed_token_is_rejected() {
        let config = test_config("supa-secret");
        assert!(verify_supabase_token("not-a-jwt", &config).is_err());
    }
}
