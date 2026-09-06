//! Live-PostgreSQL migration evidence (platform final rework F1/F2).
//!
//! Ignored by default: requires a reachable PostgreSQL where the current OS
//! user may CREATE DATABASE. Point `MIGRATION_EVIDENCE_ADMIN_DB` at an admin
//! database (never printed). Defaults to the local development server.
//!
//! Run: `cargo test --test platform -- --ignored --test-threads=1` (backend/).
//!
//! Cases (isolated throwaway databases, dropped afterwards; the dev
//! `task_scheduler_db` is only read/clone-templated, never modified):
//! - A fresh bootstrap: baseline REFUSES the empty DB, dependency-ordered
//!   bootstrap applies, idempotent re-run, stock `sqlx::migrate!` compatible.
//! - B already-deployed: clone of the real dev DB (has applied history) →
//!   forward-only pending apply, no re-execution of applied versions.
//! - C pre-existing legacy schema without history: normal run refuses;
//!   explicit baseline validates the fingerprint and marks ONLY the
//!   represented dependency prefix (Stale → forward apply → Current);
//!   partial schemas (only `users`) are refused by baseline.
//! - D tampered histories: missing interior version, checksum mismatch, and
//!   ahead/unknown version are each classified by `probe_state` and surfaced
//!   by `/health/ready` as 503 (never Current).
//! - E synthetic full history without schema: probe reports PartialSchema and
//!   `/health/ready` stays 503 even though history "looks" complete.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use actix_web::{
    http::StatusCode,
    test as awtest,
    web::{self},
    App,
};
use sqlx::{migrate::Migrator, postgres::PgPoolOptions, PgPool};
use task_scheduler_backend::migration_runner::{self, MigrationOutcome, MigrationState};

static STOCK_MIGRATOR: Migrator = sqlx::migrate!("./migrations");

const INTERIOR_VERSION: i64 = 20_250_408_000_000;
const CHECKSUM_VERSION: i64 = 20_250_319_000_000;
const AHEAD_VERSION: i64 = 20_990_101_000_000;

fn admin_db_url() -> String {
    std::env::var("MIGRATION_EVIDENCE_ADMIN_DB")
        .unwrap_or_else(|_| "postgres://longapple@127.0.0.1:5432/postgres".to_string())
}

async fn admin_pool() -> PgPool {
    PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&admin_db_url())
        .await
        .expect("admin database reachable")
}

fn unique_db_name(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("{}_{}_{}", prefix, std::process::id(), now)
}

async fn create_database(admin: &PgPool, name: &str) {
    sqlx::query(&format!("CREATE DATABASE \"{}\"", name))
        .execute(admin)
        .await
        .expect("create evidence database");
}

async fn drop_database(admin: &PgPool, name: &str) {
    let _ = sqlx::query(&format!(
        "DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)",
        name
    ))
    .execute(admin)
    .await;
}

async fn db_pool(name: &str) -> PgPool {
    let url = admin_db_url()
        .rsplit_once('/')
        .map(|(base, _)| format!("{}/{}", base, name))
        .expect("admin url with database path");
    PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&url)
        .await
        .expect("connect evidence database")
}

async fn table_exists(pool: &PgPool, table: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables \
         WHERE table_schema = 'public' AND table_name = $1)",
    )
    .bind(table)
    .fetch_one(pool)
    .await
    .unwrap_or(false)
}

async fn successful_migration_count(pool: &PgPool) -> i64 {
    let has_table: bool =
        sqlx::query_scalar::<_, bool>("SELECT to_regclass('public._sqlx_migrations') IS NOT NULL")
            .fetch_one(pool)
            .await
            .expect("check migrations table");
    if !has_table {
        return 0;
    }
    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM _sqlx_migrations WHERE success")
        .fetch_one(pool)
        .await
        .expect("count applied migrations")
}

/// Hit `/health/ready` through the real route stack with the given pool.
async fn readiness_endpoint(pool: &PgPool) -> (StatusCode, serde_json::Value) {
    let app = awtest::init_service(
        App::new()
            .app_data(web::Data::new(Arc::new(pool.clone())))
            .configure(task_scheduler_backend::api::routes::config),
    )
    .await;
    let response = awtest::call_service(
        &app,
        awtest::TestRequest::get().uri("/health/ready").to_request(),
    )
    .await;
    let status = response.status();
    (status, awtest::read_body_json(response).await)
}

/// Build a "legacy" schema WITHOUT history by executing the embedded
/// migration SQL in dependency (bootstrap) order for versions <= `through`.
async fn build_legacy_schema(pool: &PgPool, through: i64) {
    let dep_order: Vec<i64> = [
        20_250_319_000_000,
        20_230_705_000_001,
        20_240_616_000_001,
        20_250_408_000_000,
        20_250_501_000_000,
        20_260_325_000_000,
        20_260_328_000_001,
    ]
    .into_iter()
    .take_while(|version| *version <= through)
    .collect();

    let mut conn = pool.acquire().await.expect("acquire");
    for version in dep_order {
        let migration = STOCK_MIGRATOR
            .migrations
            .iter()
            .find(|m| m.version == version)
            .expect("version present in embedded chain");
        sqlx::raw_sql(migration.sql.as_ref())
            .execute(&mut *conn)
            .await
            .unwrap_or_else(|e| panic!("execute legacy migration {version}: {e}"));
    }
}

// ---------------------------------------------------------------- Case A

#[actix_web::test]
#[ignore = "requires local PostgreSQL (MIGRATION_EVIDENCE_ADMIN_DB)"]
async fn evidence_a_fresh_bootstrap_is_complete_idempotent_and_stock_compatible() {
    let admin = admin_pool().await;
    let db = unique_db_name("platform_evidence_fresh");
    create_database(&admin, &db).await;
    let pool = db_pool(&db).await;

    let result = async {
        // Baseline must REFUSE an empty database (F1): no fingerprint matches.
        let refused = migration_runner::baseline(&pool).await;
        let message = refused.unwrap_err().to_string();
        assert!(message.contains("baseline refused"), "{}", message);
        assert!(message.contains("ANY embedded version"), "{}", message);

        // Empty DB → dependency-ordered bootstrap.
        let outcome = migration_runner::run(&pool).await.expect("bootstrap");
        assert_eq!(
            outcome,
            MigrationOutcome::BootstrappedFresh {
                applied: STOCK_MIGRATOR.migrations.len()
            }
        );

        // Full schema present (FKs resolved by order, not version).
        for table in [
            "users",
            "projects",
            "tasks",
            "comments",
            "notifications",
            "plans",
            "reports",
        ] {
            assert!(table_exists(&pool, table).await, "table {} missing", table);
        }

        // History recorded for the whole chain and current.
        assert_eq!(
            successful_migration_count(&pool).await,
            STOCK_MIGRATOR.migrations.len() as i64
        );
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Current {
                version: migration_runner::latest_embedded_version()
            }
        );

        // Idempotent: second run applies nothing.
        assert_eq!(
            migration_runner::run(&pool).await.unwrap(),
            MigrationOutcome::ForwardOnly { applied: 0 }
        );

        // Byte-compatibility: STOCK sqlx migrator (version order) validates
        // checksums of bootstrap-recorded rows and succeeds.
        STOCK_MIGRATOR
            .run(&pool)
            .await
            .expect("stock migrator compatible");

        Ok::<(), sqlx::Error>(())
    }
    .await;

    pool.close().await;
    drop_database(&admin, &db).await;
    admin.close().await;
    result.unwrap();
}

// ---------------------------------------------------------------- Case B

#[actix_web::test]
#[ignore = "requires local PostgreSQL (MIGRATION_EVIDENCE_ADMIN_DB)"]
async fn evidence_b_already_deployed_history_migrates_forward_only() {
    let admin = admin_pool().await;

    // Template source must be idle for CREATE DATABASE ... TEMPLATE.
    let busy: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = 'task_scheduler_db'",
    )
    .fetch_one(&admin)
    .await
    .unwrap_or(0);
    if busy > 0 {
        eprintln!("SKIP: task_scheduler_db has active connections; cannot clone");
        admin.close().await;
        return;
    }

    let db = unique_db_name("platform_evidence_clone");
    sqlx::query(&format!(
        "CREATE DATABASE \"{}\" TEMPLATE task_scheduler_db",
        db
    ))
    .execute(&admin)
    .await
    .expect("clone dev database (applied history)");
    let pool = db_pool(&db).await;

    let result = async {
        // Clone starts behind the embedded chain.
        let before = migration_runner::probe_state(&pool).await.unwrap();
        let expected_pending = match before {
            MigrationState::Stale { applied, expected } => STOCK_MIGRATOR
                .migrations
                .iter()
                .filter(|m| m.version > applied && m.version <= expected)
                .count(),
            other => panic!("expected Stale, got {:?}", other),
        };
        assert!(expected_pending >= 2, "expected pending migrations");

        // Forward-only apply of pending versions.
        let outcome = migration_runner::run(&pool).await.expect("forward-only");
        assert_eq!(
            outcome,
            MigrationOutcome::ForwardOnly {
                applied: expected_pending
            }
        );
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Current {
                version: migration_runner::latest_embedded_version()
            }
        );

        // Applied rows untouched: count == bootstrap total.
        assert_eq!(
            successful_migration_count(&pool).await,
            STOCK_MIGRATOR.migrations.len() as i64
        );
        Ok::<(), sqlx::Error>(())
    }
    .await;

    pool.close().await;
    drop_database(&admin, &db).await;
    admin.close().await;
    result.unwrap();
}

// ---------------------------------------------------------------- Case C

#[actix_web::test]
#[ignore = "requires local PostgreSQL (MIGRATION_EVIDENCE_ADMIN_DB)"]
async fn evidence_c_baseline_validates_and_marks_only_represented_versions() {
    let admin = admin_pool().await;
    let db = unique_db_name("platform_evidence_baseline");
    create_database(&admin, &db).await;
    let pool = db_pool(&db).await;

    let result = async {
        // Legacy schema through 20250501 (dev-DB-equivalent), no history.
        build_legacy_schema(&pool, 20_250_501_000_000).await;

        // Normal run must refuse (schema without history).
        let refused = migration_runner::run(&pool).await;
        assert!(refused.is_err(), "must refuse schema without history");
        assert!(refused.unwrap_err().to_string().contains("baseline"));

        // Baseline validates the fingerprint and marks ONLY the represented
        // dependency prefix (5 versions <= 20250501), not the whole chain.
        assert_eq!(
            migration_runner::baseline(&pool).await.unwrap(),
            MigrationOutcome::BaselineMarked {
                marked: 5,
                represented_version: 20_250_501_000_000,
            }
        );
        // Nothing new was executed; pending versions remain.
        assert_eq!(
            successful_migration_count(&pool).await,
            5,
            "baseline must not over-mark the chain"
        );
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Stale {
                applied: 20_250_501_000_000,
                expected: migration_runner::latest_embedded_version(),
            }
        );

        // The 2 truly-pending versions then apply normally → Current.
        assert_eq!(
            migration_runner::run(&pool).await.unwrap(),
            MigrationOutcome::ForwardOnly { applied: 2 }
        );
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Current {
                version: migration_runner::latest_embedded_version()
            }
        );

        // Synthetic rows are byte-compatible with stock sqlx.
        STOCK_MIGRATOR
            .run(&pool)
            .await
            .expect("stock migrator compatible after baseline");

        // Baseline is not repeatable once history exists.
        assert!(migration_runner::baseline(&pool).await.is_err());
        Ok::<(), sqlx::Error>(())
    }
    .await;

    pool.close().await;
    drop_database(&admin, &db).await;
    result.unwrap();

    // Partial import (only `users`) matches NO fingerprint → baseline refuses.
    let db2 = unique_db_name("platform_evidence_partial");
    create_database(&admin, &db2).await;
    let pool2 = db_pool(&db2).await;
    let result2 = async {
        sqlx::query("CREATE TABLE users (user_id UUID PRIMARY KEY)")
            .execute(&pool2)
            .await
            .unwrap();

        let refused = migration_runner::baseline(&pool2).await;
        let message = refused.unwrap_err().to_string();
        assert!(message.contains("baseline refused"), "{}", message);
        assert!(message.contains("ANY embedded version"), "{}", message);
        // No synthetic history was written.
        assert_eq!(successful_migration_count(&pool2).await, 0);
        Ok::<(), sqlx::Error>(())
    }
    .await;
    pool2.close().await;
    drop_database(&admin, &db2).await;
    admin.close().await;
    result2.unwrap();
}

// ---------------------------------------------------------------- Case D

#[actix_web::test]
#[ignore = "requires local PostgreSQL (MIGRATION_EVIDENCE_ADMIN_DB)"]
async fn evidence_d_tampered_histories_are_never_current_or_ready() {
    let admin = admin_pool().await;
    let db = unique_db_name("platform_evidence_tamper");
    create_database(&admin, &db).await;
    let pool = db_pool(&db).await;

    let result = async {
        // Bring the DB to a genuine Current state first.
        migration_runner::run(&pool).await.expect("bootstrap");
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Current {
                version: migration_runner::latest_embedded_version()
            }
        );

        // (1) Missing interior version: delete an interior history row.
        let saved: (i64, String, Vec<u8>, i64) = sqlx::query_as(
            "SELECT version, description, checksum, execution_time \
             FROM _sqlx_migrations WHERE version = $1",
        )
        .bind(INTERIOR_VERSION)
        .fetch_one(&pool)
        .await
        .expect("save interior row");
        sqlx::query("DELETE FROM _sqlx_migrations WHERE version = $1")
            .bind(INTERIOR_VERSION)
            .execute(&pool)
            .await
            .unwrap();

        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::MissingInterior {
                version: INTERIOR_VERSION
            }
        );
        let (code, body) = readiness_endpoint(&pool).await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["migrations"], "missing-interior");

        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, success, checksum, \
             execution_time) VALUES ($1, $2, TRUE, $3, $4)",
        )
        .bind(saved.0)
        .bind(&saved.1)
        .bind(&saved.2)
        .bind(saved.3)
        .execute(&pool)
        .await
        .unwrap();

        // (2) Checksum mismatch: corrupt the initial-schema row's checksum.
        let original: Vec<u8> =
            sqlx::query_scalar("SELECT checksum FROM _sqlx_migrations WHERE version = $1")
                .bind(CHECKSUM_VERSION)
                .fetch_one(&pool)
                .await
                .expect("save checksum");
        sqlx::query("UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2")
            .bind(vec![0xDE_u8, 0xAD, 0xBE, 0xEF])
            .bind(CHECKSUM_VERSION)
            .execute(&pool)
            .await
            .unwrap();

        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::ChecksumMismatch {
                version: CHECKSUM_VERSION
            }
        );
        let (code, body) = readiness_endpoint(&pool).await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["migrations"], "checksum-mismatch");

        sqlx::query("UPDATE _sqlx_migrations SET checksum = $1 WHERE version = $2")
            .bind(&original)
            .bind(CHECKSUM_VERSION)
            .execute(&pool)
            .await
            .unwrap();

        // (3) Ahead/unknown version: history contains 2099… which the binary
        // does not know.
        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, success, checksum, \
             execution_time) VALUES ($1, 'future', TRUE, '\\x00'::bytea, 0)",
        )
        .bind(AHEAD_VERSION)
        .execute(&pool)
        .await
        .unwrap();

        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Ahead {
                version: AHEAD_VERSION,
                latest: migration_runner::latest_embedded_version(),
            }
        );
        let (code, body) = readiness_endpoint(&pool).await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["migrations"], "ahead");

        sqlx::query("DELETE FROM _sqlx_migrations WHERE version = $1")
            .bind(AHEAD_VERSION)
            .execute(&pool)
            .await
            .unwrap();

        // Restored history is Current again (guards are precise, not sticky).
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::Current {
                version: migration_runner::latest_embedded_version()
            }
        );
        let (code, body) = readiness_endpoint(&pool).await;
        assert_eq!(code, StatusCode::OK);
        assert_eq!(body["migrations"], "current");

        Ok::<(), sqlx::Error>(())
    }
    .await;

    pool.close().await;
    drop_database(&admin, &db).await;
    admin.close().await;
    result.unwrap();
}

// ---------------------------------------------------------------- Case E

#[actix_web::test]
#[ignore = "requires local PostgreSQL (MIGRATION_EVIDENCE_ADMIN_DB)"]
async fn evidence_e_synthetic_full_history_without_schema_is_partial_schema() {
    let admin = admin_pool().await;
    let db = unique_db_name("platform_evidence_synth");
    create_database(&admin, &db).await;
    let pool = db_pool(&db).await;

    let result = async {
        // Tampered database: complete synthetic history (correct versions and
        // checksums) recorded on a database with NO application schema.
        sqlx::query(
            "CREATE TABLE _sqlx_migrations ( \
                 version BIGINT PRIMARY KEY, description TEXT NOT NULL, \
                 installed_on TIMESTAMPTZ NOT NULL DEFAULT now(), \
                 success BOOLEAN NOT NULL, checksum BYTEA NOT NULL, \
                 execution_time BIGINT NOT NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();
        for migration in STOCK_MIGRATOR.migrations.iter() {
            sqlx::query(
                "INSERT INTO _sqlx_migrations (version, description, success, checksum, \
                 execution_time) VALUES ($1, $2, TRUE, $3, -1)",
            )
            .bind(migration.version)
            .bind(&*migration.description)
            .bind(&*migration.checksum)
            .execute(&pool)
            .await
            .unwrap();
        }

        // History "claims" the full chain, but the schema contract fails.
        assert_eq!(
            migration_runner::probe_state(&pool).await.unwrap(),
            MigrationState::PartialSchema
        );
        assert!(!table_exists(&pool, "users").await);
        assert!(!table_exists(&pool, "projects").await);

        // Readiness refuses: never 200 for a structurally unusable database.
        let (code, body) = readiness_endpoint(&pool).await;
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["status"], "not_ready");
        assert_eq!(body["database"], "up");
        assert_eq!(body["migrations"], "partial-schema");

        Ok::<(), sqlx::Error>(())
    }
    .await;

    pool.close().await;
    drop_database(&admin, &db).await;
    admin.close().await;
    result.unwrap();
}
