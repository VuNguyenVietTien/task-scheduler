//! W1b auth parity integration tests (no network).
//!
//! Covers the Phase 2 dual-verification contract:
//! - Supabase HS256 token verification (`auth::supabase`),
//! - Supabase→app claims mapping (`auth::identity`),
//! - legacy JWT fallback inside `resolve_bearer_claims`,
//! - REST cookie payload round-trip (`auth::cookies`).
//!
//! The `PgPool` used by the legacy-path test is created with `connect_lazy`,
//! so no connection is ever attempted (the legacy path never queries the DB).

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use task_scheduler_backend::api::auth::{
    bearer_or_auth_cookie, firebase_email_matches, refresh_response_body,
    resolve_app_identity_with_fallback, validate_firebase_login, verified_firebase_email,
    AppAuthIdentity, FirebaseLoginData,
};
use task_scheduler_backend::auth::{cookies, identity, service, supabase};
use task_scheduler_backend::config::{Config, CookiePolicy, CookieSameSite};

fn config_with(jwt_secret: &str, supabase_jwt_secret: &str) -> Config {
    Config {
        jwt_secret: jwt_secret.to_string(),
        supabase_jwt_secret: supabase_jwt_secret.to_string(),
        ..Default::default()
    }
}

fn make_hs256_token(secret: &str, sub: &str, email: &str, expires_in: i64) -> String {
    let claims = json!({
        "sub": sub,
        "email": email,
        "exp": (chrono::Utc::now() + chrono::Duration::seconds(expires_in)).timestamp(),
        "iat": chrono::Utc::now().timestamp(),
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

/// Lazy pool: the legacy path performs no queries, so nothing connects.
/// Short acquire timeout so the Supabase-path identity query fails fast
/// (it soft-fails by design) instead of burning sqlx's default 30s.
fn lazy_pool() -> sqlx::PgPool {
    PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_millis(250))
        .connect_lazy("postgres://127.0.0.1:1/paranoid_no_connect")
        .expect("lazy pool must not connect")
}

#[test]
fn supabase_token_verifies_when_secret_configured() {
    let config = config_with("legacy", "supa-secret");
    let token = make_hs256_token(
        "supa-secret",
        "11111111-1111-1111-1111-111111111111",
        "jane@x.com",
        3600,
    );
    let claims = supabase::verify_supabase_token(&token, &config).unwrap();
    assert_eq!(claims.sub, "11111111-1111-1111-1111-111111111111");
    assert_eq!(claims.email.as_deref(), Some("jane@x.com"));
    assert_eq!(claims.role.as_deref(), Some("authenticated"));
}

#[test]
fn supabase_token_with_wrong_secret_is_rejected() {
    let config = config_with("legacy", "supa-secret");
    let token = make_hs256_token("not-the-secret", "sub", "jane@x.com", 3600);
    assert!(supabase::verify_supabase_token(&token, &config).is_err());
}

#[test]
fn supabase_token_expired_is_rejected_as_token_expired() {
    let config = config_with("legacy", "supa-secret");
    let token = make_hs256_token("supa-secret", "sub", "jane@x.com", -3600);
    match supabase::verify_supabase_token(&token, &config) {
        Err(task_scheduler_backend::auth::AuthError::TokenExpired) => {}
        other => panic!("expected TokenExpired, got {:?}", other.map(|_| ())),
    }
}

#[test]
fn supabase_token_rejected_when_secret_env_missing() {
    let config = config_with("legacy", ""); // SUPABASE_JWT_SECRET not set
    let token = make_hs256_token("supa-secret", "sub", "jane@x.com", 3600);
    match supabase::verify_supabase_token(&token, &config) {
        Err(task_scheduler_backend::auth::AuthError::Unauthorized(msg)) => {
            assert!(msg.contains("SUPABASE_JWT_SECRET"), "msg: {}", msg);
        }
        other => panic!("expected Unauthorized, got {:?}", other.map(|_| ())),
    }
}

#[tokio::test]
async fn resolve_bearer_claims_prefers_supabase_when_configured() {
    let config = config_with("legacy", "supa-secret");
    let token = make_hs256_token(
        "supa-secret",
        "11111111-1111-1111-1111-111111111111",
        "jane@x.com",
        3600,
    );
    // No DB: identity resolution fails softly → falls back to the auth UUID,
    // which must still resolve into app claims (web parity).
    let pool = lazy_pool();
    let claims = identity::resolve_bearer_claims(&token, &pool, &config)
        .await
        .expect("supabase token must resolve");
    assert_eq!(claims.sub, "11111111-1111-1111-1111-111111111111");
    assert_eq!(claims.email, "jane@x.com");
}

#[tokio::test]
async fn resolve_bearer_claims_falls_back_to_legacy_jwt() {
    let config = config_with("legacy-secret", "supa-secret");
    // Token signed with the LEGACY secret, not the Supabase secret.
    let token = make_hs256_token(
        "legacy-secret",
        "22222222-2222-2222-2222-222222222222",
        "legacy@x.com",
        3600,
    );
    let pool = lazy_pool();
    let claims = identity::resolve_bearer_claims(&token, &pool, &config)
        .await
        .expect("legacy token must resolve via fallback");
    assert_eq!(claims.sub, "22222222-2222-2222-2222-222222222222");
    assert_eq!(claims.email, "legacy@x.com");
}

#[tokio::test]
async fn resolve_bearer_claims_rejects_garbage() {
    let config = config_with("legacy-secret", "supa-secret");
    let pool = lazy_pool();
    assert!(
        identity::resolve_bearer_claims("garbage-token", &pool, &config)
            .await
            .is_err()
    );
}

#[test]
fn supabase_identity_maps_to_app_claims() {
    let supa_claims = supabase::SupabaseClaims {
        sub: "11111111-1111-1111-1111-111111111111".to_string(),
        email: Some("jane@x.com".to_string()),
        exp: 4_102_444_800,
        iat: Some(1_700_000_000),
        role: Some("authenticated".to_string()),
        aud: None,
    };
    let app_id = uuid::Uuid::new_v4();
    let resolved = supabase::SupabaseIdentity {
        auth_user_id: supa_claims.sub.clone(),
        email: "jane@x.com".to_string(),
        name: Some("Jane".to_string()),
        app_user_id: Some(app_id),
    };
    let claims = identity::claims_from_supabase(&supa_claims, &resolved);
    assert_eq!(claims.sub, app_id.to_string(), "app user_id wins");
    assert_eq!(claims.display_name, "Jane");

    let unresolved = supabase::SupabaseIdentity {
        auth_user_id: supa_claims.sub.clone(),
        email: "jane@x.com".to_string(),
        name: None,
        app_user_id: None,
    };
    let claims = identity::claims_from_supabase(&supa_claims, &unresolved);
    assert_eq!(claims.sub, "11111111-1111-1111-1111-111111111111");
    assert_eq!(claims.display_name, "jane", "email local-part fallback");
}

#[test]
fn user_session_cookie_round_trip() {
    let session = cookies::UserSession {
        user_id: "33333333-3333-3333-3333-333333333333".to_string(),
        email: "jane@x.com".to_string(),
        name: "Jane".to_string(),
    };
    let cookie = cookies::user_session_cookie(&session, &CookiePolicy::default()).unwrap();
    let parsed = cookies::parse_user_session(cookie.value()).unwrap();
    assert_eq!(parsed.user_id, session.user_id);
    assert_eq!(parsed.email, session.email);
    assert!(cookies::parse_user_session("{invalid").is_none());
}

// --- F1: collision-safe usernames ---

#[test]
fn username_candidates_sanitize_and_suffix() {
    let c = service::username_candidates("john", "john@gmail.com");
    assert_eq!(c.len(), 2, "bounded retry");
    assert_eq!(c[0], "john");
    assert!(c[1].starts_with("john_"), "timestamp suffix: {}", c[1]);

    // Review scenario: two different domains sharing a local part must not 500.
    let other = service::username_candidates("john", "john@outlook.com");
    assert_ne!(c[0], "", "base never empty");
    assert_ne!(other[0], "");

    // Display names with spaces/unicode are sanitized to the username charset.
    let display = service::username_candidates("Jane Doe!", "jane@x.com");
    assert_eq!(display[0], "Jane_Doe");
}

#[test]
fn sanitize_username_base_falls_back_to_user() {
    assert_eq!(service::sanitize_username_base("!!!"), "user");
    assert_eq!(service::sanitize_username_base(""), "user");
}

// --- F2: refresh credential + response keys ---

#[test]
fn refresh_credential_accepts_cookie_when_bearer_absent() {
    use actix_web::test::TestRequest;
    // Web consumer: credentials include, no Authorization header
    let req = TestRequest::default()
        .insert_header(("Cookie", "auth-token=cookie-tok"))
        .to_http_request();
    assert_eq!(bearer_or_auth_cookie(&req).as_deref(), Some("cookie-tok"));
    // Bearer takes precedence when both exist
    let req = TestRequest::default()
        .insert_header(("Authorization", "Bearer btok"))
        .insert_header(("Cookie", "auth-token=ctok"))
        .to_http_request();
    assert_eq!(bearer_or_auth_cookie(&req).as_deref(), Some("btok"));
    // Nothing → None (handler 401s)
    let req = TestRequest::default().to_http_request();
    assert!(bearer_or_auth_cookie(&req).is_none());
}

#[test]
fn refresh_response_includes_all_token_keys() {
    let body = refresh_response_body("fresh", 42);
    for key in ["token", "access_token", "accessToken"] {
        assert_eq!(body[key], "fresh", "missing key {}", key);
    }
    assert_eq!(body["expires_in"], 42);
}

#[tokio::test]
async fn firebase_cookie_fallback_resolves_fresh_app_user_id() {
    let expected_app_id = uuid::Uuid::new_v4();
    let resolved = resolve_app_identity_with_fallback(
        "firebase-cookie-token",
        |_token| async {
            Err(task_scheduler_backend::auth::AuthError::InvalidToken(
                "not a Supabase or legacy JWT".to_string(),
            ))
        },
        |_token| async {
            verified_firebase_email(Some("firebase-user@example.com".to_string()), Some(true))
        },
        move |verified_email| async move {
            assert_eq!(verified_email, "firebase-user@example.com");
            Ok(AppAuthIdentity {
                user_id: expected_app_id,
                email: verified_email,
                display_name: "Firebase User".to_string(),
                email_verified: true,
            })
        },
    )
    .await
    .expect("verified Firebase fallback should resolve an app identity");

    assert_eq!(resolved.user_id, expected_app_id);
    assert_eq!(resolved.email, "firebase-user@example.com");
}

#[tokio::test]
async fn firebase_cookie_fallback_rejects_unverified_or_empty_email() {
    for (email, verified) in [
        (Some("firebase-user@example.com".to_string()), Some(false)),
        (Some("   ".to_string()), Some(true)),
        (None, Some(true)),
    ] {
        let lookup_called = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let lookup_observer = lookup_called.clone();
        let result = resolve_app_identity_with_fallback(
            "firebase-cookie-token",
            |_token| async {
                Err(task_scheduler_backend::auth::AuthError::InvalidToken(
                    "not a Supabase or legacy JWT".to_string(),
                ))
            },
            move |_token| async move { verified_firebase_email(email, verified) },
            move |_verified_email| async move {
                use std::sync::atomic::Ordering;
                lookup_observer.store(true, Ordering::SeqCst);
                unreachable!("unverified Firebase identity must not reach app lookup")
            },
        )
        .await;

        assert!(result.is_err());
        assert!(
            !lookup_called.load(std::sync::atomic::Ordering::SeqCst),
            "app lookup must not run for an unverified/empty Firebase email"
        );
    }
}

// --- F3: firebase login validation + email cross-check ---

#[test]
fn firebase_login_missing_fields_rejected() {
    let full = FirebaseLoginData {
        firebase_token: Some("t".into()),
        email: Some("a@b.c".into()),
        name: None,
        firebase_uid: Some("u".into()),
    };
    assert!(validate_firebase_login(&full).is_ok());
    let mut bad = full;
    bad.firebase_uid = None;
    assert_eq!(
        validate_firebase_login(&bad).unwrap_err(),
        "Firebase token, email, and uid are required"
    );
}

#[test]
fn firebase_email_claim_mismatch_detected() {
    assert!(!firebase_email_matches(Some("x@y.z"), "a@b.c"));
    assert!(firebase_email_matches(Some("A@B.C"), "a@b.c"));
    assert!(firebase_email_matches(None, "a@b.c"));
}

// --- F4: email-exists classification ---

#[test]
fn email_exists_is_400_not_500() {
    use actix_web::ResponseError;
    let err = task_scheduler_backend::auth::AuthError::EmailExists;
    assert_eq!(err.status_code(), actix_web::http::StatusCode::BAD_REQUEST);
}

// --- /me hardening + cookie policy ---

#[test]
fn cookie_policy_samesite_none_forces_secure() {
    let config = Config {
        cookie_secure: false,
        cookie_same_site: CookieSameSite::None,
        cookie_http_only: false,
        ..Default::default()
    };
    let policy = config.cookie_policy();
    assert!(policy.secure, "SameSite=None must force Secure");
}

#[test]
fn cookie_policy_defaults_preserve_compat() {
    let config = Config::default();
    let policy = config.cookie_policy();
    assert_eq!(policy.same_site, CookieSameSite::Lax);
    assert!(!policy.secure);
    assert!(!policy.http_only);
}

#[test]
fn supabase_already_exists_error_is_recognized() {
    let err = task_scheduler_backend::auth::AuthError::Other(
        "Supabase Admin API /auth/v1/admin/users returned 422: A user with this email address has already been registered".to_string(),
    );
    assert!(supabase::is_user_already_exists_error(&err));
    let other = task_scheduler_backend::auth::AuthError::Other("network error".to_string());
    assert!(!supabase::is_user_already_exists_error(&other));
}
