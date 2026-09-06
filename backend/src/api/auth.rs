use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::{future::Future, sync::Arc};
use uuid::Uuid;
use validator::Validate;

use crate::auth::{
    auth_common, cookies,
    error::AuthError,
    identity,
    service::AuthService,
    supabase::{self, SupabaseAdminClient},
};
use crate::config::{Config, CookiePolicy};
use crate::firebase::FirebaseService;

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterData {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 6))]
    pub password: String,
    #[validate(length(min = 2))]
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginData {
    pub email: String,
    pub password: String,
}

/// All identity-bearing fields are `Option` so missing-field validation happens
/// in the handler and returns the web-parity 400 `{error}` shape (F3.3) instead
/// of serde's default 4xx body.
#[derive(Debug, Deserialize)]
pub struct FirebaseLoginData {
    pub firebase_token: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub firebase_uid: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub email: String,
    pub name: String,
}

/// Canonical app identity loaded from the `users` table after a token issuer
/// (Supabase, legacy Rust JWT, or Firebase) has been cryptographically verified.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppAuthIdentity {
    pub user_id: Uuid,
    pub email: String,
    pub display_name: String,
    pub email_verified: bool,
}

fn require_non_empty_email(email: String, issuer: &str) -> Result<String, AuthError> {
    let email = email.trim();
    if email.is_empty() {
        Err(AuthError::Unauthorized(format!(
            "{} identity is missing an email",
            issuer
        )))
    } else {
        Ok(email.to_string())
    }
}

/// Firebase fallback requires both a non-empty email claim and
/// `email_verified=true` before that email can select an app user.
pub fn verified_firebase_email(
    email: Option<String>,
    email_verified: Option<bool>,
) -> Result<String, AuthError> {
    if email_verified != Some(true) {
        return Err(AuthError::Unauthorized(
            "Firebase email is not verified".to_string(),
        ));
    }
    require_non_empty_email(email.unwrap_or_default(), "Firebase")
}

/// Mockable issuer-fallback orchestration used by `/me` and `/refresh`.
///
/// The closures keep tests network-free: dual JWT verification is attempted
/// first; only failure (including an empty signed email) invokes the Firebase
/// verifier; the selected verified email is then resolved to a fresh app user.
pub async fn resolve_app_identity_with_fallback<D, DFut, F, FFut, L, LFut>(
    token: &str,
    dual_verify: D,
    firebase_verify: F,
    app_lookup: L,
) -> Result<AppAuthIdentity, AuthError>
where
    D: FnOnce(String) -> DFut,
    DFut: Future<Output = Result<String, AuthError>>,
    F: FnOnce(String) -> FFut,
    FFut: Future<Output = Result<String, AuthError>>,
    L: FnOnce(String) -> LFut,
    LFut: Future<Output = Result<AppAuthIdentity, AuthError>>,
{
    let token = token.to_string();
    let dual_email = dual_verify(token.clone())
        .await
        .and_then(|email| require_non_empty_email(email, "JWT"));
    let verified_email = match dual_email {
        Ok(email) => email,
        Err(_) => firebase_verify(token)
            .await
            .and_then(|email| require_non_empty_email(email, "Firebase"))?,
    };
    app_lookup(verified_email).await
}

async fn load_app_identity_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<AppAuthIdentity, AuthError> {
    let row = sqlx::query(
        "SELECT user_id, email, COALESCE(NULLIF(name, ''), username, '') AS display_name, \
         email_verified FROM users WHERE email = $1 LIMIT 1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(AuthError::Database)?
    .ok_or_else(|| AuthError::Unauthorized("Verified identity has no app user".to_string()))?;

    let db_email: String = row.get("email");
    let display_name: String = row.try_get("display_name").unwrap_or_default();
    Ok(AppAuthIdentity {
        user_id: row.get("user_id"),
        email: db_email.clone(),
        display_name: if display_name.is_empty() {
            identity::email_local_part(&db_email)
        } else {
            display_name
        },
        email_verified: row.try_get("email_verified").unwrap_or(false),
    })
}

/// Resolve any accepted token issuer to a fresh canonical app identity.
/// Supabase/legacy verification runs first; Firebase is the fallback for the
/// `auth-token` cookie issued by `/firebase/login`.
pub(crate) async fn resolve_app_identity(
    token: &str,
    pool: &PgPool,
    config: &Config,
    firebase_service: &FirebaseService,
) -> Result<AppAuthIdentity, AuthError> {
    resolve_app_identity_with_fallback(
        token,
        |token| async move {
            identity::resolve_bearer_claims(&token, pool, config)
                .await
                .map(|claims| claims.email)
        },
        |token| async move {
            let (firebase_user, _) = firebase_service
                .verify_token_and_get_claims(&token)
                .await
                .map_err(|e| {
                    AuthError::Unauthorized(format!("Firebase token verification failed: {}", e))
                })?;
            verified_firebase_email(firebase_user.email, firebase_user.email_verified)
        },
        |email| async move { load_app_identity_by_email(pool, &email).await },
    )
    .await
}

/// Bearer token from the Authorization header, if present.
fn bearer_token(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|t| t.to_string())
}

/// Credential for token-consuming endpoints (F2): Bearer header first, else the
/// `auth-token` cookie (web sends `credentials: 'include'` with no header).
pub fn bearer_or_auth_cookie(req: &HttpRequest) -> Option<String> {
    bearer_token(req).or_else(|| {
        req.cookie(cookies::AUTH_TOKEN_COOKIE)
            .map(|c| c.value().to_string())
    })
}

/// Web-parity missing-field validation for `/firebase/login` (F3.3).
pub fn validate_firebase_login(data: &FirebaseLoginData) -> Result<(), &'static str> {
    match (
        data.firebase_token.as_ref(),
        data.email.as_ref(),
        data.firebase_uid.as_ref(),
    ) {
        (Some(t), Some(e), Some(u)) if !t.is_empty() && !e.is_empty() && !u.is_empty() => Ok(()),
        _ => Err("Firebase token, email, and uid are required"),
    }
}

/// Web-parity email cross-check (F3.1): when the Firebase ID token carries an
/// email claim, it must match the request email (case-insensitive).
pub fn firebase_email_matches(token_email: Option<&str>, request_email: &str) -> bool {
    match token_email {
        Some(token_email) => token_email
            .trim()
            .eq_ignore_ascii_case(request_email.trim()),
        None => true, // no email claim on token — nothing to contradict
    }
}

/// POST /api/v1/auth/register — dual-mode (web parity when Supabase is configured).
///
/// Web parity (`web/src/app/api/auth/register/route.ts`): creates a Supabase
/// auth user with `email_confirm: false`, then ensures the app `users` row.
/// Error handling (F4): email-exists → 400 `{success:false, error}`; an app-row
/// failure *after* the Supabase user was created is non-fatal (web treats the
/// profile insert the same way — logging and still returning success) so we
/// never orphan the Supabase user while telling the client "failed".
pub async fn register(
    auth_service: web::Data<AuthService>,
    config: web::Data<Config>,
    data: web::Json<RegisterData>,
) -> Result<impl Responder, AuthError> {
    data.validate()
        .map_err(|e| AuthError::ValidationError(e.to_string()))?;

    if config.supabase_auth_configured() {
        let admin = SupabaseAdminClient::from_config(config.get_ref())?;
        if let Err(e) = admin
            .create_user(
                &data.email,
                Some(&data.password),
                false,
                json!({ "name": data.name }),
            )
            .await
        {
            if !supabase::is_user_already_exists_error(&e) {
                return Err(AuthError::ValidationError(e.to_string()));
            }
        }
    }

    // App row + password hash. Failure semantics depend on whether the Supabase
    // auth user was already created (F4).
    let supabase_user_created = config.supabase_auth_configured();
    match auth_service
        .register(data.email.clone(), data.password.clone(), data.name.clone())
        .await
    {
        Ok((access_token, _refresh, user)) => Ok(HttpResponse::Ok().json(json!({
            // Web parity fields
            "success": true,
            "message": "Registration successful. Please verify your email.",
            "user": { "id": user.user_id.to_string(), "email": user.email, "name": data.name },
            // Legacy fields (mobile clients)
            "user_id": user.user_id.to_string(),
            "email": user.email,
            "name": user.username.unwrap_or_else(|| data.name.clone()),
            "token": access_token,
        }))),
        Err(AuthError::EmailExists) => Ok(HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "Email already exists",
        }))),
        Err(e) if supabase_user_created => {
            // Supabase auth user exists now; web treats profile-insert failure as
            // non-fatal. Log loudly and return success WITHOUT app-row fields.
            eprintln!(
                "[register] App users-row insert failed after Supabase user creation \
                 (non-fatal, web parity) for {}: {}",
                data.email, e
            );
            Ok(HttpResponse::Ok().json(json!({
                "success": true,
                "message": "Registration successful. Please verify your email.",
            })))
        }
        Err(e) => Err(e),
    }
}

pub async fn login(
    auth_service: web::Data<AuthService>,
    data: web::Json<LoginData>,
) -> Result<impl Responder, AuthError> {
    let user = auth_service
        .login(data.email.clone(), data.password.clone())
        .await?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        user_id: user.user_id.to_string(),
        email: user.email,
        name: user.username.unwrap_or_default(),
    }))
}

/// POST /api/v1/auth/firebase/login — web parity.
///
/// Mirrors `web/src/app/api/auth/firebase/login/route.ts`:
/// 1. verify the Firebase ID token; UID **and** (when present) email claim must
///    match the request; failures → 403 (F3.1/F3.2), missing fields → 400
///    `{error}` (F3.3),
/// 2. upsert the app `users` row so `users.user_id` is the identity,
/// 3. ensure a Supabase auth user exists and generate a magic-link session,
/// 4. respond `{success, user{id,email,name}, session}` and set the
///    `auth-token` / `user-session` cookies (24h, configurable SameSite/Secure/
///    HttpOnly — see `Config::cookie_policy`).
pub async fn firebase_login(
    auth_service: web::Data<AuthService>,
    firebase_service: web::Data<FirebaseService>,
    config: web::Data<Config>,
    data: web::Json<FirebaseLoginData>,
) -> Result<impl Responder, AuthError> {
    if let Err(msg) = validate_firebase_login(&data) {
        return Ok(HttpResponse::BadRequest().json(json!({ "error": msg })));
    }
    let data_email = data.email.clone().unwrap();
    let data_uid = data.firebase_uid.clone().unwrap();
    let data_token = data.firebase_token.clone().unwrap();

    // Verify Firebase token. Web returns 403 on verification failure (F3.2).
    let (firebase_user, _) = firebase_service
        .verify_token_and_get_claims(&data_token)
        .await
        .map_err(|e| AuthError::Forbidden(format!("Firebase token verification failed: {}", e)))?;

    // Token must belong to the same user: UID match (F3.1a) + email claim match
    // (F3.1b, case-insensitive, skipped when the token has no email claim).
    if firebase_user.uid != data_uid {
        return Err(AuthError::Forbidden("Token UID mismatch".to_string()));
    }
    if !firebase_email_matches(firebase_user.email.as_deref(), &data_email) {
        return Err(AuthError::Forbidden("Token email mismatch".to_string()));
    }

    // Upsert the app users row (uid-first, then email; collision-safe username)
    let name = data
        .name
        .clone()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| identity::email_local_part(&data_email));
    let (user, _created) = auth_service
        .get_ref()
        .upsert_user_by_email(data_email.clone(), name.clone(), data_uid.clone())
        .await?;

    let app_user_id = user.user_id.to_string();
    let user_name = user.username.clone().unwrap_or_else(|| name.clone());

    // Ensure a Supabase auth user exists, then generate the magic-link session.
    // `session` is the Supabase `generateLink` payload (contains
    // `properties.email_otp`) or `null` when Supabase is not configured.
    let session: Value = if config.supabase_auth_configured() {
        let admin = SupabaseAdminClient::from_config(config.get_ref())?;
        match admin.generate_magic_link(&data_email).await {
            Ok(link) => link,
            Err(_) => {
                // Auth user may not exist yet — create it, then retry (web parity).
                let create_err = admin
                    .create_user(
                        &data_email,
                        None,
                        true,
                        json!({
                            "name": user_name,
                            "firebase_uid": data_uid,
                            "firebase_migrated": true,
                        }),
                    )
                    .await
                    .err();
                if let Some(e) = create_err {
                    if !supabase::is_user_already_exists_error(&e) {
                        return Err(e);
                    }
                }
                admin.generate_magic_link(&data_email).await?
            }
        }
    } else {
        Value::Null
    };

    let policy = config.cookie_policy();
    let mut builder = HttpResponse::Ok();
    builder.cookie(cookies::auth_token_cookie(&data_token, &policy));
    let session_payload = cookies::UserSession {
        user_id: app_user_id,
        email: data_email.clone(),
        name: user_name.clone(),
    };
    if let Ok(cookie) = cookies::user_session_cookie(&session_payload, &policy) {
        builder.cookie(cookie);
    }

    Ok(builder.json(json!({
        "success": true,
        "user": { "id": session_payload.user_id, "email": session_payload.email, "name": session_payload.name },
        "session": session,
    })))
}

/// GET /api/v1/auth/me — hardened (manager decision on N1).
///
/// The `user-session` JSON cookie is NEVER trusted as an identity assertion.
/// Identity = verify the `auth-token` cookie (or Bearer header) — dual JWT
/// (Supabase HS256 → legacy Rust JWT), with a Firebase ID-token fallback since
/// the web flow stores the Firebase token in `auth-token` — then load a fresh
/// `users` row from the DB. Any invalid/expired credential, malformed session
/// cookie, or missing DB row → 401 `{user: null}` with BOTH cookies cleared.
pub async fn me(
    req: HttpRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
    firebase_service: web::Data<FirebaseService>,
) -> Result<impl Responder, AuthError> {
    let clear_and_unauthorized = || {
        let mut builder = HttpResponse::Unauthorized();
        builder.cookie(cookies::expired_cookie(cookies::AUTH_TOKEN_COOKIE));
        builder.cookie(cookies::expired_cookie(cookies::USER_SESSION_COOKIE));
        builder.json(json!({ "user": Value::Null }))
    };

    let credential = bearer_or_auth_cookie(&req);
    let token = match credential {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(clear_and_unauthorized()),
    };

    let app_identity = match resolve_app_identity(
        &token,
        pool.get_ref().as_ref(),
        config.get_ref(),
        firebase_service.get_ref(),
    )
    .await
    {
        Ok(identity) => identity,
        Err(AuthError::Database(e)) => return Err(AuthError::Database(e)),
        Err(_) => return Ok(clear_and_unauthorized()),
    };

    Ok(HttpResponse::Ok().json(json!({
        "user": {
            "id": app_identity.user_id.to_string(),
            "email": app_identity.email,
            "name": app_identity.display_name,
            "emailVerified": app_identity.email_verified,
        }
    })))
}

/// POST /api/v1/auth/logout — web parity (`web/src/app/api/auth/logout/route.ts`).
/// Clears the auth cookies and confirms with `{success, message}`.
pub async fn logout() -> Result<impl Responder, AuthError> {
    let mut builder = HttpResponse::Ok();
    builder.cookie(cookies::expired_cookie(cookies::AUTH_TOKEN_COOKIE));
    builder.cookie(cookies::expired_cookie(cookies::USER_SESSION_COOKIE));
    Ok(builder.json(json!({
        "success": true,
        "message": "Logged out successfully",
    })))
}

/// POST /api/v1/auth/resend-verification — consumed by the web proxy route
/// (`web/src/app/api/auth/resend-verification/route.ts`, Bearer auth).
///
/// Verifies the caller (dual), then — when Supabase is configured — generates a
/// fresh magic link (the verification email). Responds with the shape the web
/// proxy reads: `{ user: { id, email, emailVerified } }`.
pub async fn resend_verification(
    req: HttpRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
) -> Result<impl Responder, AuthError> {
    let token = bearer_or_auth_cookie(&req)
        .ok_or_else(|| AuthError::Unauthorized("Unauthorized - Please log in again".into()))?;

    let claims =
        identity::resolve_bearer_claims(&token, pool.get_ref().as_ref(), config.get_ref()).await?;

    let row =
        sqlx::query("SELECT user_id, email, email_verified FROM users WHERE email = $1 LIMIT 1")
            .bind(&claims.email)
            .fetch_optional(pool.get_ref().as_ref())
            .await
            .map_err(AuthError::Database)?
            .ok_or(AuthError::UserNotFound)?;

    let verified: bool = row.try_get("email_verified").unwrap_or(false);

    if !verified && config.supabase_auth_configured() {
        let admin = SupabaseAdminClient::from_config(config.get_ref())?;
        admin
            .generate_magic_link(row.get::<String, _>("email").as_str())
            .await?;
    }

    Ok(HttpResponse::Ok().json(json!({
        "user": {
            "id": row.get::<Uuid, _>("user_id").to_string(),
            "email": row.get::<String, _>("email"),
            "emailVerified": verified,
        }
    })))
}

/// POST /api/v1/auth/refresh — token refresh (F2, manager decision b).
///
/// Serves both deploy shapes (Next.js-only proxies and Next.js+Rust):
/// - Credential: `Authorization: Bearer` first, else the `auth-token` cookie
///   (web callers use `credentials: 'include'` with no header).
/// - Verification order: Supabase HS256 → legacy Rust JWT → Firebase ID token.
///   Firebase fallback requires `email_verified=true`, then reloads the app user
///   by email so the minted token always carries the canonical app `user_id`.
/// - Response carries `accessToken` (web `api.ts` reads camelCase), `access_token`
///   and `token` (legacy/mobile consumers), plus `token_type`/`expires_in`.
pub async fn refresh(
    req: HttpRequest,
    pool: web::Data<Arc<PgPool>>,
    config: web::Data<Config>,
    firebase_service: web::Data<FirebaseService>,
) -> Result<impl Responder, AuthError> {
    let token = bearer_or_auth_cookie(&req).ok_or_else(|| {
        AuthError::Unauthorized("Missing Bearer token or auth-token cookie".into())
    })?;

    let app_identity = resolve_app_identity(
        &token,
        pool.get_ref().as_ref(),
        config.get_ref(),
        firebase_service.get_ref(),
    )
    .await?;

    let new_token = auth_common::create_token(
        app_identity.user_id,
        app_identity.email.clone(),
        app_identity.display_name.clone(),
        config.get_ref(),
    )?;

    Ok(HttpResponse::Ok().json(refresh_response_body(&new_token, config.jwt_expiry)))
}

/// Pure response builder for `/refresh` (unit-tested): all three token keys.
pub fn refresh_response_body(new_token: &str, expires_in: i64) -> Value {
    json!({
        "token": new_token,
        "access_token": new_token,
        "accessToken": new_token,
        "token_type": "Bearer",
        "expires_in": expires_in,
    })
}

/// Pure cookie-policy derivation passthrough for tests / reuse.
pub fn cookie_policy(config: &Config) -> CookiePolicy {
    config.cookie_policy()
}

pub async fn verify_email(
    auth_service: web::Data<AuthService>,
    token: web::Path<String>,
) -> Result<impl Responder, AuthError> {
    auth_service.verify_email(token.into_inner()).await?;
    Ok(HttpResponse::Ok().finish())
}

pub async fn request_password_reset(
    auth_service: web::Data<AuthService>,
    email: web::Json<String>,
) -> Result<impl Responder, AuthError> {
    auth_service
        .request_password_reset(email.into_inner())
        .await?;
    Ok(HttpResponse::Ok().finish())
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordData {
    pub token: String,
    pub new_password: String,
}

pub async fn reset_password(
    auth_service: web::Data<AuthService>,
    data: web::Json<ResetPasswordData>,
) -> Result<impl Responder, AuthError> {
    auth_service
        .reset_password(data.token.clone(), data.new_password.clone())
        .await?;
    Ok(HttpResponse::Ok().finish())
}

/// Configure authentication routes (mounted by `api/routes.rs` under `/api/v1`).
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/firebase/login", web::post().to(firebase_login))
            .route("/me", web::get().to(me))
            .route("/logout", web::post().to(logout))
            .route("/resend-verification", web::post().to(resend_verification))
            .route("/refresh", web::post().to(refresh))
            .route("/verify-email/{token}", web::get().to(verify_email))
            .route(
                "/request-password-reset",
                web::post().to(request_password_reset),
            )
            .route("/reset-password", web::post().to(reset_password))
            .route(
                "/users/{user_id}/change-password",
                web::post().to(change_password),
            ),
    );
}

/// F2(b) alias mount: the web consumer (`web/src/lib/api.ts`) calls
/// `POST ${BACKEND_URL}/api/auth/refresh` — **no `/v1`**. This config mounts
/// the same `refresh` handler under an `/auth` scope intended to be nested at
/// `/api`. W1b may not edit `api/routes.rs`; the owner needs this one line:
///
/// ```ignore
/// // in api/routes.rs::config
/// cfg.service(web::scope("/api").configure(auth::alias_config));
/// ```
pub fn alias_config(cfg: &mut web::ServiceConfig) {
    cfg.service(web::scope("/auth").route("/refresh", web::post().to(refresh)));
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordData {
    pub old_password: String,
    pub new_password: String,
}

pub async fn change_password(
    auth_service: web::Data<AuthService>,
    user_id: web::Path<String>,
    data: web::Json<ChangePasswordData>,
) -> Result<impl Responder, AuthError> {
    let user_id = uuid::Uuid::parse_str(&user_id).map_err(|_| AuthError::InvalidUserId)?;

    auth_service
        .change_password(
            user_id,
            data.old_password.clone(),
            data.new_password.clone(),
        )
        .await?;
    Ok(HttpResponse::Ok().finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bearer_token_extracts_only_bearer_scheme() {
        let req = actix_web::test::TestRequest::default()
            .insert_header(("Authorization", "Bearer abc.def"))
            .to_http_request();
        assert_eq!(bearer_token(&req).as_deref(), Some("abc.def"));

        let req = actix_web::test::TestRequest::default()
            .insert_header(("Authorization", "Basic abc"))
            .to_http_request();
        assert_eq!(bearer_token(&req), None);

        let req = actix_web::test::TestRequest::default().to_http_request();
        assert_eq!(bearer_token(&req), None);
    }

    #[test]
    fn bearer_or_auth_cookie_prefers_bearer_then_cookie() {
        // Bearer wins over cookie
        let req = actix_web::test::TestRequest::default()
            .insert_header(("Authorization", "Bearer header-token"))
            .insert_header(("Cookie", "auth-token=cookie-token"))
            .to_http_request();
        assert_eq!(bearer_or_auth_cookie(&req).as_deref(), Some("header-token"));

        // Cookie used when Bearer absent (web `credentials: 'include'` flow)
        let req = actix_web::test::TestRequest::default()
            .insert_header(("Cookie", "auth-token=cookie-token"))
            .to_http_request();
        assert_eq!(bearer_or_auth_cookie(&req).as_deref(), Some("cookie-token"));

        // Nothing present
        let req = actix_web::test::TestRequest::default().to_http_request();
        assert_eq!(bearer_or_auth_cookie(&req), None);
    }

    #[test]
    fn firebase_login_validation_returns_web_error_message() {
        let mut data = FirebaseLoginData {
            firebase_token: Some("tok".into()),
            email: Some("a@b.c".into()),
            name: None,
            firebase_uid: Some("uid".into()),
        };
        assert_eq!(validate_firebase_login(&data), Ok(()));

        data.email = None;
        assert_eq!(
            validate_firebase_login(&data),
            Err("Firebase token, email, and uid are required")
        );

        data.email = Some("".into());
        assert!(validate_firebase_login(&data).is_err());
    }

    #[test]
    fn firebase_email_must_match_request_when_claim_present() {
        assert!(firebase_email_matches(Some("a@b.c"), "a@b.c"));
        assert!(
            firebase_email_matches(Some("A@B.C"), "a@b.c"),
            "case-insensitive"
        );
        assert!(!firebase_email_matches(Some("other@b.c"), "a@b.c"));
        assert!(firebase_email_matches(None, "a@b.c"), "no claim → skip");
    }

    #[test]
    fn refresh_body_carries_all_token_key_spellings() {
        let body = refresh_response_body("the-new-token", 3600);
        assert_eq!(
            body["accessToken"], "the-new-token",
            "web api.ts reads camelCase"
        );
        assert_eq!(body["access_token"], "the-new-token");
        assert_eq!(body["token"], "the-new-token", "legacy/mobile key");
        assert_eq!(body["token_type"], "Bearer");
        assert_eq!(body["expires_in"], 3600);
    }

    #[test]
    fn email_exists_maps_to_bad_request() {
        use actix_web::ResponseError;
        assert_eq!(
            AuthError::EmailExists.status_code(),
            actix_web::http::StatusCode::BAD_REQUEST
        );
    }
}
