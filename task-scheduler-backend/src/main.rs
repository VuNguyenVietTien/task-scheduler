use actix_web::{web, App, HttpServer};
use actix_cors::Cors;
use sea_orm::Database;

mod api;
mod auth;
mod config;
mod email;
mod firebase;

use auth::AuthService;
use firebase::FirebaseService;
use config::Config;
use email::EmailService;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Set up logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Load configuration
    let config = Config::from_env();
    
    // Clone config values we need before wrapping in web::Data
    let host = config.host.clone();
    let port = config.port;
    let config = web::Data::new(config);
    
    // Database connection
    let db = Database::connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Email service
    let email_service = EmailService::new(
        config.smtp_host.clone(),
        config.smtp_username.clone(),
        config.smtp_password.clone(),
        "noreply@example.com".to_string(), // TODO: Add smtp_from to Config struct
    ).expect("Failed to create email service");

    // Auth service
    let auth_service = web::Data::new(AuthService::new(
        db.clone(),
        config.jwt_secret.clone().into_bytes(),
        email_service,
        config.frontend_url.clone(),
    ));

    let db_data = web::Data::new(db);
    // Initialize Firebase service
    let firebase_service = web::Data::new(
        FirebaseService::new(config.firebase_service_account_path.clone())
            .expect("Failed to initialize Firebase service")
    );

    let config_clone = config.clone();
    let firebase_service_clone = firebase_service.clone();

    let server = HttpServer::new(move || {
        // Configure CORS based on environment
        let cors = Cors::default()
            .allowed_origin(&config_clone.frontend_url)
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec![
                "Authorization",
                "Content-Type",
                "X-Requested-With",
                "Accept",
            ])
            .supports_credentials()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .configure(api::init)
            .app_data(db_data.clone())
            .app_data(auth_service.clone())
            .app_data(config_clone.clone())
            .app_data(firebase_service_clone.clone())
    })
    .bind((host.clone(), port))?
    .run();

    println!("Server running at http://{}:{}/", host, port);
    println!("Environment: {}", config.app_env);

    server.await
}
