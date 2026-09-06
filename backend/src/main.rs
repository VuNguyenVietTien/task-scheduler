mod api;
mod auth;
mod config;
mod db;
mod domain;
mod error;
mod firebase;
mod graphql;
mod migration_runner;
mod utils;
mod websocket;

use actix_web::{guard, web, App, HttpServer};
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Arc;
use std::time::Duration;

use crate::{
    api::routes,
    auth::AuthService,
    config::{Config, DB_CONNECT_TIMEOUT, DB_MAX_CONNECTIONS},
    firebase::FirebaseService,
    graphql::{
        dataloaders::{ProjectLoader, UserLoader},
        handlers::{graphql_handler, graphql_playground},
        schema::create_schema,
    },
    websocket::{ws_connect, NotificationBroadcaster},
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Setup logging to both terminal and backend.log file
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("backend.log")
        .expect("Failed to open backend.log");
    let log_file = std::sync::Mutex::new(log_file);

    env_logger::Builder::from_default_env()
        .format(move |buf, record| {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let line = format!(
                "[{} {} {}] {}\n",
                timestamp,
                record.level(),
                record.target(),
                record.args()
            );
            // Write to log file
            if let Ok(mut file) = log_file.lock() {
                let _ = file.write_all(line.as_bytes());
            }
            // Write to terminal
            write!(buf, "{}", line)
        })
        .init();

    eprintln!("Starting application...");

    let config = Config::from_env().expect("Failed to load config");
    let addr = format!("{}:{}", config.server_host, config.server_port);

    // Use an explicit bounded pool rather than PgPool::connect defaults.
    let pool = Arc::new(
        PgPoolOptions::new()
            .max_connections(DB_MAX_CONNECTIONS)
            .acquire_timeout(Duration::from_secs(DB_CONNECT_TIMEOUT))
            .connect(&config.database_url)
            .await
            .expect("Failed to connect to database"),
    );

    if config.run_migrations {
        match migration_runner::run(pool.as_ref()).await {
            Ok(outcome) => eprintln!("Database migrations: {:?}", outcome),
            Err(e) => panic!("Database migration failed: {}", e),
        }
    }

    eprintln!("Database connected");

    // Setup notification broadcaster
    let broadcaster = Arc::new(NotificationBroadcaster::new(100));

    println!("Starting server at http://{}", addr);

    // Initialize services
    let auth_service = web::Data::new(AuthService::new(pool.as_ref().clone()));

    // Initialize Firebase service
    let firebase_service = web::Data::new(
        FirebaseService::new("config/firebase-service-account.json".to_string())
            .expect("Failed to initialize Firebase service"),
    );

    // Create dataloaders
    let project_loader = web::Data::new(ProjectLoader::new(pool.as_ref().clone()));
    let user_loader = web::Data::new(UserLoader::new(pool.as_ref().clone()));
    let config = web::Data::new(config);
    let pool_data = web::Data::new(pool.clone());

    // Create GraphQL schema with database pool and config
    let schema = web::Data::new(create_schema(
        pool.as_ref().clone(),
        config.get_ref().clone(),
    ));

    // Start HTTP server
    HttpServer::new(move || {
        // Exact configured allowlist; wildcard credentialed CORS is forbidden.
        let cors = routes::build_cors(config.get_ref());

        App::new()
            .wrap(cors)
            .app_data(schema.clone())
            .app_data(pool_data.clone())
            .app_data(config.clone())
            .app_data(project_loader.clone())
            .app_data(user_loader.clone())
            .app_data(auth_service.clone())
            .app_data(firebase_service.clone())
            .app_data(web::Data::new(Arc::clone(&broadcaster)))
            .configure(routes::config) // Add API routes
            .service(
                web::resource("/graphql")
                    .guard(guard::Post())
                    .to(graphql_handler),
            )
            .service(
                web::resource("/graphql")
                    .guard(guard::Get())
                    .to(graphql_playground),
            )
            .service(web::resource("/ws").guard(guard::Get()).to(ws_connect))
    })
    .bind(addr)?
    .run()
    .await
}
