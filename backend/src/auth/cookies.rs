//! Auth cookie helpers for REST auth parity with the web Next.js routes
//! (`web/src/app/api/auth/firebase/login|logout/route.ts`).
//!
//! Parity contract:
//! - `auth-token`   — raw bearer token (web stores the Firebase ID token).
//! - `user-session` — JSON `{userId, email, name}` where `userId` is the app
//!   `users.user_id` (NOT the Supabase auth UUID) so FK references keep working.
//! - 24h max-age, path=/.
//!
//! Deployment-configurable attributes (F2 rework / N2 hardening), via
//! `COOKIE_SAMESITE` (lax|none|strict), `COOKIE_SECURE`, `COOKIE_HTTP_ONLY`:
//! - `Lax` + non-Secure is the compatibility default (local dev, same-site).
//! - `None` is for public cross-site deploys (e.g. app.example.com →
//!   api.other-domain.com); browsers require `Secure` with `None`, so the
//!   policy enforces it (see `Config::cookie_policy`).
//! - `HttpOnly=false` is kept for web parity (the frontend reads `auth-token`
//!   from JS via `getAuthHeaders`); production deployments that don't need
//!   JS access should set `COOKIE_HTTP_ONLY=true`.

use actix_web::cookie::{time::Duration, time::OffsetDateTime, Cookie, SameSite};
use serde::{Deserialize, Serialize};

use crate::config::CookiePolicy;

pub const AUTH_TOKEN_COOKIE: &str = "auth-token";
pub const USER_SESSION_COOKIE: &str = "user-session";
/// 24 hours, matching the web routes (`60 * 60 * 24`).
pub const COOKIE_MAX_AGE_SECS: i64 = 24 * 60 * 60;

/// Parsed payload of the `user-session` cookie.
///
/// NOTE: informational only — since the W1b rework, `/me` never trusts this
/// JSON as an identity assertion; identity always comes from verifying the
/// `auth-token` cookie / Bearer token and loading a fresh DB row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub user_id: String,
    pub email: String,
    pub name: String,
}

fn actix_same_site(policy: &CookiePolicy) -> SameSite {
    match policy.same_site {
        crate::config::CookieSameSite::Lax => SameSite::Lax,
        crate::config::CookieSameSite::None => SameSite::None,
        crate::config::CookieSameSite::Strict => SameSite::Strict,
    }
}

/// Build the `auth-token` cookie.
pub fn auth_token_cookie(token: &str, policy: &CookiePolicy) -> Cookie<'static> {
    Cookie::build(AUTH_TOKEN_COOKIE, token.to_string())
        .path("/")
        .http_only(policy.http_only)
        .same_site(actix_same_site(policy))
        .secure(policy.secure)
        .max_age(Duration::seconds(COOKIE_MAX_AGE_SECS))
        .finish()
}

/// Build the `user-session` cookie from a session payload.
pub fn user_session_cookie(
    session: &UserSession,
    policy: &CookiePolicy,
) -> Result<Cookie<'static>, serde_json::Error> {
    let value = serde_json::to_string(session)?;
    Ok(Cookie::build(USER_SESSION_COOKIE, value)
        .path("/")
        .http_only(policy.http_only)
        .same_site(actix_same_site(policy))
        .secure(policy.secure)
        .max_age(Duration::seconds(COOKIE_MAX_AGE_SECS))
        .finish())
}

/// Expired cookie used to clear state on logout / invalid sessions.
pub fn expired_cookie(name: &str) -> Cookie<'static> {
    Cookie::build(name.to_string(), "")
        .path("/")
        .max_age(Duration::ZERO)
        .expires(OffsetDateTime::UNIX_EPOCH)
        .finish()
}

/// Parse a `user-session` cookie value. Returns `None` on malformed JSON.
pub fn parse_user_session(value: &str) -> Option<UserSession> {
    serde_json::from_str(value).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{CookiePolicy, CookieSameSite};

    fn lax() -> CookiePolicy {
        CookiePolicy::default()
    }

    #[test]
    fn user_session_round_trip() {
        let session = UserSession {
            user_id: "33333333-3333-3333-3333-333333333333".to_string(),
            email: "jane@x.com".to_string(),
            name: "Jane".to_string(),
        };
        let cookie = user_session_cookie(&session, &lax()).unwrap();
        let parsed = parse_user_session(cookie.value()).expect("must parse");
        assert_eq!(parsed.user_id, session.user_id);
        assert_eq!(parsed.email, session.email);
        assert_eq!(parsed.name, session.name);
    }

    #[test]
    fn user_session_cookie_attrs_match_web() {
        let session = UserSession {
            user_id: "u".to_string(),
            email: "e@x.com".to_string(),
            name: "E".to_string(),
        };
        let cookie = user_session_cookie(
            &session,
            &CookiePolicy {
                secure: true,
                http_only: false,
                same_site: CookieSameSite::Lax,
            },
        )
        .unwrap();
        assert_eq!(cookie.name(), USER_SESSION_COOKIE);
        assert_eq!(cookie.path(), Some("/"));
        assert!(!cookie.http_only().unwrap_or(true));
        assert!(cookie.secure().unwrap_or(false));
        assert_eq!(
            cookie.max_age().map(|d| d.whole_seconds()),
            Some(COOKIE_MAX_AGE_SECS)
        );
    }

    #[test]
    fn samesite_none_is_applied_and_needs_secure() {
        let session = UserSession {
            user_id: "u".to_string(),
            email: "e@x.com".to_string(),
            name: "E".to_string(),
        };
        let policy = CookiePolicy {
            secure: true, // enforced upstream by Config::cookie_policy
            http_only: true,
            same_site: CookieSameSite::None,
        };
        let cookie = user_session_cookie(&session, &policy).unwrap();
        assert_eq!(cookie.same_site(), Some(SameSite::None));
        assert!(cookie.http_only().unwrap_or(false));
        assert!(cookie.secure().unwrap_or(false));

        let token_cookie = auth_token_cookie("tok", &policy);
        assert_eq!(token_cookie.same_site(), Some(SameSite::None));
        assert!(token_cookie.http_only().unwrap_or(false));
    }

    #[test]
    fn compat_defaults_are_lax_and_readable() {
        let cookie = auth_token_cookie("tok", &lax());
        assert_eq!(cookie.same_site(), Some(SameSite::Lax));
        assert!(!cookie.http_only().unwrap_or(true));
        assert!(!cookie.secure().unwrap_or(true));
    }

    #[test]
    fn malformed_user_session_is_rejected() {
        assert!(parse_user_session("not json").is_none());
        assert!(parse_user_session("{}").is_none()); // missing fields
    }

    #[test]
    fn expired_cookie_is_immediately_stale() {
        let cookie = expired_cookie(AUTH_TOKEN_COOKIE);
        assert_eq!(cookie.max_age().map(|d| d.whole_seconds()), Some(0));
        assert!(cookie.expires().is_some());
    }
}
