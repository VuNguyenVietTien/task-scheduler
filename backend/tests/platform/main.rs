use std::{collections::HashMap, sync::Arc, time::Duration};

use actix_web::{
    http::{header, StatusCode},
    test as awtest, web, App, HttpResponse,
};
use sqlx::postgres::PgPoolOptions;
use task_scheduler_backend::{
    api::routes::{build_cors, config as platform_routes, readiness_decision, ReadinessInput},
    config::{Config, CookieSameSite},
    migration_runner::MigrationState,
};

fn development_values() -> HashMap<String, String> {
    HashMap::from([
        ("DATABASE_URL".into(), "postgres://localhost/test".into()),
        ("JWT_SECRET".into(), "development-jwt-secret".into()),
        ("FRONTEND_ORIGINS".into(), "http://localhost:3000".into()),
    ])
}

fn production_values() -> HashMap<String, String> {
    HashMap::from([
        ("APP_ENV".into(), "production".into()),
        ("DATABASE_URL".into(), "postgres://localhost/prod".into()),
        (
            "JWT_SECRET".into(),
            "jwt-production-secret-0123456789-abcdef".into(),
        ),
        (
            "AUTH_SECRET".into(),
            "auth-production-secret-fedcba9876543210".into(),
        ),
        (
            "FRONTEND_ORIGINS".into(),
            "https://app.example.com,https://staging.example.com".into(),
        ),
        // F3: production cookie baseline
        ("COOKIE_SECURE".into(), "true".into()),
        ("COOKIE_HTTP_ONLY".into(), "true".into()),
    ])
}

#[test]
fn config_supports_host_port_aliases_and_server_precedence() {
    let mut values = development_values();
    values.insert("HOST".into(), "0.0.0.0".into());
    values.insert("PORT".into(), "9090".into());
    let config = Config::from_map(&values).unwrap();
    assert_eq!(config.server_host, "0.0.0.0");
    assert_eq!(config.server_port, 9090);

    values.insert("SERVER_HOST".into(), "127.0.0.2".into());
    values.insert("SERVER_PORT".into(), "9191".into());
    let config = Config::from_map(&values).unwrap();
    assert_eq!(config.server_host, "127.0.0.2");
    assert_eq!(config.server_port, 9191);
}

#[test]
fn production_defaults_to_safe_loopback_bind() {
    // F4: no HOST/SERVER_HOST → 127.0.0.1 (never silently all interfaces).
    let config = Config::from_map(&production_values()).unwrap();
    assert_eq!(config.server_host, "127.0.0.1");
    assert_eq!(config.server_port, 8080);
    assert!(!config.run_migrations);
    assert_eq!(
        config.frontend_origins,
        vec!["https://app.example.com", "https://staging.example.com"]
    );
}

#[test]
fn production_container_sets_explicit_public_bind() {
    // F4: containers opt in explicitly via HOST (Docker/compose contract).
    let mut values = production_values();
    values.insert("HOST".into(), "0.0.0.0".into());
    let config = Config::from_map(&values).unwrap();
    assert_eq!(config.server_host, "0.0.0.0");
}

#[test]
fn production_allows_only_the_exact_http_local_development_origin() {
    let mut values = production_values();
    values.insert(
        "FRONTEND_ORIGINS".into(),
        "https://prjmngr.vercel.app,http://localhost:3000".into(),
    );
    let config = Config::from_map(&values).unwrap();
    assert_eq!(
        config.frontend_origins,
        vec!["https://prjmngr.vercel.app", "http://localhost:3000"]
    );

    for rejected in ["http://localhost:3001", "http://127.0.0.1:3000"] {
        values.insert("FRONTEND_ORIGINS".into(), rejected.into());
        assert!(Config::from_map(&values).is_err(), "accepted {rejected}");
    }
}

#[test]
fn production_rejects_missing_origins_weak_secrets_and_wildcards() {
    let mut values = production_values();
    values.remove("FRONTEND_ORIGINS");
    assert!(Config::from_map(&values).is_err());

    let mut values = production_values();
    values.insert("JWT_SECRET".into(), "change-me".into());
    assert!(Config::from_map(&values).is_err());

    let mut values = production_values();
    values.insert("FRONTEND_ORIGINS".into(), "https://*.example.com".into());
    assert!(Config::from_map(&values).is_err());

    let mut values = production_values();
    values.insert("FRONTEND_ORIGINS".into(), "http://app.example.com".into());
    assert!(Config::from_map(&values).is_err());
}

// --- F3: production cookie policy fails closed ---

#[test]
fn production_rejects_insecure_cookie_defaults() {
    // COOKIE_SECURE unset → boot error even with HttpOnly set.
    let mut values = production_values();
    values.remove("COOKIE_SECURE");
    let err = Config::from_map(&values).unwrap_err();
    assert!(err.to_string().contains("COOKIE_SECURE"), "{}", err);

    // COOKIE_HTTP_ONLY unset without compatibility opt-in → boot error.
    let mut values = production_values();
    values.remove("COOKIE_HTTP_ONLY");
    let err = Config::from_map(&values).unwrap_err();
    assert!(err.to_string().contains("COOKIE_HTTP_ONLY"), "{}", err);
    assert!(err.to_string().contains("COOKIE_JS_COMPAT"), "{}", err);
}

#[test]
fn production_accepts_compatibility_mode_only_explicitly() {
    // js-compat + secure is valid: token stays readable by JS deliberately.
    let mut values = production_values();
    values.remove("COOKIE_HTTP_ONLY");
    values.insert("COOKIE_JS_COMPAT".into(), "true".into());
    let config = Config::from_map(&values).unwrap();
    assert!(config.cookie_js_compat);
    assert!(!config.cookie_http_only);
    assert!(config.cookie_secure);
}

#[test]
fn production_hardened_cookie_policy_parses() {
    let config = Config::from_map(&production_values()).unwrap();
    assert!(config.cookie_secure);
    assert!(config.cookie_http_only);
    assert!(!config.cookie_js_compat);
    let policy = config.cookie_policy();
    assert!(policy.secure && policy.http_only);
    assert_eq!(policy.same_site, CookieSameSite::Lax);
}

// --- Readiness decision matrix (F2) ---

#[test]
fn readiness_matrix_covers_all_states() {
    // Down / timed out
    for input in [ReadinessInput::DatabaseDown, ReadinessInput::TimedOut] {
        let (code, body) = readiness_decision(input);
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body.database, "down");
    }
    // Stale schema
    let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(MigrationState::Stale {
        applied: 1,
        expected: 2,
    }));
    assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body.database, "up");
    assert_eq!(body.migrations, "stale");
    // Dirty
    let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(MigrationState::Dirty));
    assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body.migrations, "dirty");
    // Missing history
    for state in [MigrationState::NoHistoryTable, MigrationState::NoHistory] {
        let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(state));
        assert_eq!(code, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body.migrations, "missing");
    }
    // Strong-currency guards (F1/F2 rework): tampered/synthetic histories are
    // 503 with their exact labels — never treated as current.
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
    // Current → only 200 path
    let (code, body) = readiness_decision(ReadinessInput::DatabaseUp(MigrationState::Current {
        version: 2,
    }));
    assert_eq!(code, StatusCode::OK);
    assert_eq!(body.status, "ready");
    assert_eq!(body.migrations, "current");
}

// --- Endpoint behavior ---

#[actix_web::test]
async fn live_health_and_auth_refresh_aliases_are_mounted() {
    let app = awtest::init_service(App::new().configure(platform_routes)).await;

    let live = awtest::call_service(
        &app,
        awtest::TestRequest::get().uri("/health/live").to_request(),
    )
    .await;
    assert_eq!(live.status(), StatusCode::OK);
    let live_body: serde_json::Value = awtest::read_body_json(live).await;
    assert_eq!(live_body["status"], "live");
    assert_eq!(live_body["database"], "unchecked");

    for uri in ["/api/v1/auth/refresh", "/api/auth/refresh"] {
        let response =
            awtest::call_service(&app, awtest::TestRequest::post().uri(uri).to_request()).await;
        // Missing handler app-data can produce 500 in this route-only harness;
        // 404/405 would prove the route/alias was not mounted.
        assert_ne!(response.status(), StatusCode::NOT_FOUND, "{}", uri);
        assert_ne!(response.status(), StatusCode::METHOD_NOT_ALLOWED, "{}", uri);
    }
}

#[actix_web::test]
async fn readiness_is_503_when_database_is_unavailable() {
    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_millis(100))
        .connect_lazy("postgres://127.0.0.1:1/platform_readiness")
        .unwrap();
    let app = awtest::init_service(
        App::new()
            .app_data(web::Data::new(Arc::new(pool)))
            .configure(platform_routes),
    )
    .await;

    let response = awtest::call_service(
        &app,
        awtest::TestRequest::get().uri("/health/ready").to_request(),
    )
    .await;
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body: serde_json::Value = awtest::read_body_json(response).await;
    assert_eq!(body["status"], "not_ready");
    assert_eq!(body["database"], "down");
}

// --- CORS: exact-origin allow, untrusted reject, real preflight ---

#[actix_web::test]
async fn cors_allows_exact_origin_and_rejects_untrusted_origin() {
    let config = Config::from_map(&development_values()).unwrap();
    let app = awtest::init_service(
        App::new()
            .wrap(build_cors(&config))
            .route("/probe", web::get().to(HttpResponse::Ok)),
    )
    .await;

    let allowed = awtest::call_service(
        &app,
        awtest::TestRequest::get()
            .uri("/probe")
            .insert_header((header::ORIGIN, "http://localhost:3000"))
            .to_request(),
    )
    .await;
    assert_eq!(allowed.status(), StatusCode::OK);
    assert_eq!(
        allowed.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&header::HeaderValue::from_static("http://localhost:3000"))
    );
    assert_eq!(
        allowed
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS),
        Some(&header::HeaderValue::from_static("true"))
    );

    let rejected = awtest::call_service(
        &app,
        awtest::TestRequest::get()
            .uri("/probe")
            .insert_header((header::ORIGIN, "https://evil.example"))
            .to_request(),
    )
    .await;
    assert_eq!(rejected.status(), StatusCode::BAD_REQUEST);
    assert!(rejected
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        .is_none());
}

#[actix_web::test]
async fn cors_preflight_for_authorized_graphql_request() {
    let config = Config::from_map(&development_values()).unwrap();
    let app = awtest::init_service(
        App::new()
            .wrap(build_cors(&config))
            .route("/graphql", web::post().to(HttpResponse::Ok)),
    )
    .await;

    let preflight = awtest::call_service(
        &app,
        awtest::TestRequest::default()
            .method(actix_web::http::Method::OPTIONS)
            .uri("/graphql")
            .insert_header((header::ORIGIN, "http://localhost:3000"))
            .insert_header((header::ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .insert_header((
                header::ACCESS_CONTROL_REQUEST_HEADERS,
                "authorization,content-type",
            ))
            .to_request(),
    )
    .await;

    assert_eq!(preflight.status(), StatusCode::OK);
    assert_eq!(
        preflight.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&header::HeaderValue::from_static("http://localhost:3000"))
    );
    assert_eq!(
        preflight
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS),
        Some(&header::HeaderValue::from_static("true"))
    );
    let methods = preflight
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_METHODS)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    assert!(methods.contains("POST"), "methods: {}", methods);
    let headers = preflight
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_HEADERS)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    assert!(headers.contains("authorization"), "headers: {}", headers);
    assert!(headers.contains("content-type"), "headers: {}", headers);
}

mod migration_evidence;
