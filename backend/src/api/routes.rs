use std::sync::Arc;
use std::time::Duration;

use actix_cors::Cors;
use actix_web::{
    http::{header, Method, StatusCode},
    web, HttpResponse, Responder,
};
use serde::Serialize;
use sqlx::PgPool;

use crate::{
    api::{auth, media},
    config::Config,
    migration_runner::MigrationState,
};

/// Overall budget for the readiness probe (F2): DB liveness + migration
/// currency must answer well inside typical proxy/orchestrator budgets. The
/// global pool acquire timeout (30s) does NOT bound a hung query on an
/// already-acquired unhealthy connection; this does.
const READINESS_TIMEOUT: Duration = Duration::from_millis(1_500);

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub database: &'static str,
    pub migrations: &'static str,
}

/// Process liveness: does not depend on external services.
pub async fn health_live() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "live",
        database: "unchecked",
        migrations: "unchecked",
    })
}

/// Dependency readiness (F2): PostgreSQL must answer AND the schema must be
/// migration-current. Stale/missing/dirty history keeps the release out of
/// rotation (503) so traffic is not sent to a backend that cannot run
/// application queries.
pub async fn health_ready(pool: web::Data<Arc<PgPool>>) -> impl Responder {
    let probe = tokio::time::timeout(READINESS_TIMEOUT, async {
        let up: bool = sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(pool.get_ref().as_ref())
            .await
            .map(|value| value == 1)
            .unwrap_or(false);
        if !up {
            return (false, None);
        }
        let state = crate::migration_runner::probe_state(pool.get_ref().as_ref())
            .await
            .ok();
        (true, state)
    })
    .await;

    let (status_code, payload) = readiness_decision(match probe {
        Err(_elapsed) => ReadinessInput::TimedOut, // bounded: never hang the probe
        Ok((false, _)) => ReadinessInput::DatabaseDown,
        Ok((true, None)) => ReadinessInput::DatabaseDown, // state probe itself failed
        Ok((true, Some(state))) => ReadinessInput::DatabaseUp(state),
    });
    HttpResponse::build(status_code).json(payload)
}

/// Inputs to the readiness decision — kept explicit for exhaustive unit tests.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadinessInput {
    DatabaseDown,
    DatabaseUp(MigrationState),
    TimedOut,
}

/// Pure decision function: (status, response) for a readiness input.
pub fn readiness_decision(input: ReadinessInput) -> (StatusCode, HealthResponse) {
    match input {
        ReadinessInput::DatabaseDown | ReadinessInput::TimedOut => (
            StatusCode::SERVICE_UNAVAILABLE,
            HealthResponse {
                status: "not_ready",
                database: "down",
                migrations: "unchecked",
            },
        ),
        ReadinessInput::DatabaseUp(state) => match state {
            MigrationState::Current { .. } => (
                StatusCode::OK,
                HealthResponse {
                    status: "ready",
                    database: "up",
                    migrations: "current",
                },
            ),
            MigrationState::Stale { .. } => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "stale",
                },
            ),
            MigrationState::Dirty => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "dirty",
                },
            ),
            MigrationState::NoHistoryTable | MigrationState::NoHistory => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "missing",
                },
            ),
            // Strong-currency guards (F1/F2 rework): synthetic or tampered
            // histories are never ready even when the DB answers.
            MigrationState::MissingInterior { .. } => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "missing-interior",
                },
            ),
            MigrationState::ChecksumMismatch { .. } => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "checksum-mismatch",
                },
            ),
            MigrationState::Ahead { .. } => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "ahead",
                },
            ),
            MigrationState::PartialSchema => (
                StatusCode::SERVICE_UNAVAILABLE,
                HealthResponse {
                    status: "not_ready",
                    database: "up",
                    migrations: "partial-schema",
                },
            ),
        },
    }
}

/// Credentialed CORS with an exact configured allowlist. No wildcard path is
/// available; an untrusted Origin is rejected before reaching handlers.
pub fn build_cors(config: &Config) -> Cors {
    let mut cors = Cors::default()
        .allowed_methods(vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allowed_headers(vec![
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::HeaderName::from_static("x-request-id"),
        ])
        .supports_credentials()
        .block_on_origin_mismatch(true)
        .max_age(3600);

    for origin in &config.frontend_origins {
        cors = cors.allowed_origin(origin);
    }
    cors
}

/// Configures all application routes.
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.route("/health/live", web::get().to(health_live));
    cfg.route("/health/ready", web::get().to(health_ready));

    cfg.service(web::scope("/api/v1").configure(auth::config));
    // Compatibility alias consumed by web/src/lib/api.ts.
    cfg.service(web::scope("/api").configure(auth::alias_config));

    cfg.configure(media::config);
}

#[cfg(test)]
mod tests {
    use super::*;

    const STALE: MigrationState = MigrationState::Stale {
        applied: 20_250_501_000_000,
        expected: 20_260_328_000_001,
    };

    #[test]
    fn readiness_matrix_down_timeout_stale_dirty_missing_current() {
        // DB unreachable / probe timed out → 503, database down.
        for input in [ReadinessInput::DatabaseDown, ReadinessInput::TimedOut] {
            let (code, body) = readiness_decision(input);
            assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
            assert_eq!(body.status, "not_ready");
            assert_eq!(body.database, "down");
        }

        // DB up + stale history → 503 with migrations=stale.
        let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(STALE));
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body.database, "up");
        assert_eq!(body.migrations, "stale");

        // DB up + dirty row → 503 with migrations=dirty.
        let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(MigrationState::Dirty));
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body.migrations, "dirty");

        // DB up + no history (fresh/unmigrated) → 503 with migrations=missing.
        for state in [MigrationState::NoHistoryTable, MigrationState::NoHistory] {
            let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(state));
            assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
            assert_eq!(body.migrations, "missing");
        }

        // Strong-currency guards: tampered/synthetic histories stay 503 with
        // their exact labels — never treated as current.
        let guards = [
            (
                MigrationState::MissingInterior {
                    version: 20_250_408_000_000,
                },
                "missing-interior",
            ),
            (
                MigrationState::ChecksumMismatch {
                    version: 20_250_319_000_000,
                },
                "checksum-mismatch",
            ),
            (
                MigrationState::Ahead {
                    version: 20_990_101_000_000,
                    latest: 20_260_328_000_001,
                },
                "ahead",
            ),
            (MigrationState::PartialSchema, "partial-schema"),
        ];
        for (state, label) in guards {
            let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(state));
            assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE, "{}", label);
            assert_eq!(body.database, "up", "{}", label);
            assert_eq!(body.migrations, label);
        }

        // DB up + current schema → 200 ready.
        let (code, body) =
            readiness_decision(ReadinessInput::DatabaseUp(MigrationState::Current {
                version: 20_260_328_000_001,
            }));
        assert_eq!(code, StatusCode::OK);
        assert_eq!(body.status, "ready");
        assert_eq!(body.database, "up");
        assert_eq!(body.migrations, "current");
    }
}
