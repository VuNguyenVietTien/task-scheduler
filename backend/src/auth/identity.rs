//! Dual-token identity resolution (Phase 2, W1b).
//!
//! Single entry point used by the GraphQL handler and the REST auth routes:
//! a Bearer token is first treated as a **Supabase access token** (HS256 with
//! `SUPABASE_JWT_SECRET`), and when that path is not configured or the token
//! fails, we fall back to the backend's **own legacy JWT** (`JWT_SECRET`) so
//! existing mobile clients keep working.
//!
//! Supabase identity is resolved to the app `users.user_id` by email, mirroring
//! `web/src/lib/graphql/context.ts` (`appUser?.user_id ?? authUser.id`).

use sqlx::PgPool;

use crate::auth::{error::AuthError, jwt, supabase, types};
use crate::config::Config;

/// Pure mapping: verified Supabase claims + resolved identity → app claims.
///
/// `sub` becomes the app `users.user_id` when a row exists; otherwise the
/// Supabase auth UUID is kept verbatim (web-parity fallback).
pub fn claims_from_supabase(
    claims: &supabase::SupabaseClaims,
    identity: &supabase::SupabaseIdentity,
) -> types::Claims {
    let sub = identity
        .app_user_id
        .map(|id| id.to_string())
        .unwrap_or_else(|| identity.auth_user_id.clone());
    let display_name = identity
        .name
        .clone()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| email_local_part(&identity.email));
    types::Claims {
        sub,
        exp: claims.exp,
        iat: claims.iat.unwrap_or_else(|| chrono::Utc::now().timestamp()),
        email: identity.email.clone(),
        display_name,
    }
}

/// Pure mapping: legacy Rust JWT claims → app claims.
pub fn claims_from_legacy(claims: jwt::Claims) -> types::Claims {
    types::Claims {
        sub: claims.sub.clone(),
        exp: claims.exp as i64,
        iat: claims.iat as i64,
        email: claims.email,
        // Legacy tokens carry no display name; keep historical behavior (sub).
        display_name: claims.sub,
    }
}

/// Resolve a Bearer token into app claims.
///
/// Order: Supabase (only when `SUPABASE_JWT_SECRET` is configured) → legacy
/// Rust JWT. The DB is only touched on the Supabase success path (email →
/// `users.user_id`), so the legacy path performs no I/O.
pub async fn resolve_bearer_claims(
    token: &str,
    db: &PgPool,
    config: &Config,
) -> Result<types::Claims, AuthError> {
    if config.supabase_jwt_configured() {
        match supabase::verify_supabase_token(token, config) {
            Ok(supa) => {
                let identity = supabase::resolve_supabase_identity(&supa, db).await;
                return Ok(claims_from_supabase(&supa, &identity));
            }
            Err(e) => {
                // Not a valid Supabase token — fall through to the legacy JWT
                // so dual-issuer deployments serve both client generations.
                eprintln!(
                    "[Auth] Supabase verification failed, trying legacy JWT: {}",
                    e
                );
            }
        }
    }

    let legacy = jwt::verify_token(token, config)?;
    Ok(claims_from_legacy(legacy))
}

/// Local part of an email ("jane" from "jane@x.com"), used as display-name
/// fallback exactly like the web register flow (`email.split('@')[0]`).
pub fn email_local_part(email: &str) -> String {
    email.split('@').next().unwrap_or(email).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn supa_claims(sub: &str, email: &str) -> supabase::SupabaseClaims {
        supabase::SupabaseClaims {
            sub: sub.to_string(),
            email: Some(email.to_string()),
            exp: 4_102_444_800,
            iat: Some(1_700_000_000),
            role: Some("authenticated".to_string()),
            aud: None,
        }
    }

    #[test]
    fn supabase_claims_use_app_user_id_when_resolved() {
        let app_id = Uuid::new_v4();
        let identity = supabase::SupabaseIdentity {
            auth_user_id: "11111111-1111-1111-1111-111111111111".to_string(),
            email: "jane@x.com".to_string(),
            name: Some("Jane".to_string()),
            app_user_id: Some(app_id),
        };
        let claims = claims_from_supabase(&supa_claims("auth-uuid", "jane@x.com"), &identity);
        assert_eq!(claims.sub, app_id.to_string());
        assert_eq!(claims.email, "jane@x.com");
        assert_eq!(claims.display_name, "Jane");
        assert_eq!(claims.exp, 4_102_444_800);
    }

    #[test]
    fn supabase_claims_fall_back_to_auth_uuid_without_app_row() {
        let identity = supabase::SupabaseIdentity {
            auth_user_id: "11111111-1111-1111-1111-111111111111".to_string(),
            email: "jane@x.com".to_string(),
            name: None,
            app_user_id: None,
        };
        let claims = claims_from_supabase(&supa_claims("auth-uuid", "jane@x.com"), &identity);
        assert_eq!(claims.sub, "11111111-1111-1111-1111-111111111111");
        assert_eq!(claims.display_name, "jane"); // email local-part fallback
    }

    #[test]
    fn legacy_claims_map_verbatim() {
        let legacy = jwt::Claims {
            sub: "22222222-2222-2222-2222-222222222222".to_string(),
            exp: 4_102_444_800,
            iat: 1_700_000_000,
            email: "legacy@x.com".to_string(),
        };
        let claims = claims_from_legacy(legacy);
        assert_eq!(claims.sub, "22222222-2222-2222-2222-222222222222");
        assert_eq!(claims.email, "legacy@x.com");
        assert_eq!(claims.exp, 4_102_444_800);
        assert_eq!(claims.iat, 1_700_000_000);
    }

    #[test]
    fn email_local_part_handles_missing_at() {
        assert_eq!(email_local_part("noatsign"), "noatsign");
        assert_eq!(email_local_part("a@b.c"), "a");
    }
}
