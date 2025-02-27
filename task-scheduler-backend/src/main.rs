mod auth;
mod api;
mod email;
mod firebase;

use actix_web::{web, App, HttpServer};
use actix_cors::Cors;
use dotenv::dotenv;
use sea_orm::Database;
use std::env;
use auth::AuthService;
use email::EmailService;
use firebase::FirebaseService;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize environment
    dotenv().ok();
    env_logger::init();

    // Get environment variables
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set").into_bytes();
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");

    // Email configuration
    let smtp_host = env::var("SMTP_HOST").expect("SMTP_HOST must be set");
    let smtp_port = env::var("SMTP_PORT").expect("SMTP_PORT must be set")
        .parse::<u16>()
        .expect("SMTP_PORT must be a number");
    let smtp_username = env::var("SMTP_USERNAME").expect("SMTP_USERNAME must be set");
    let smtp_password = env::var("SMTP_PASSWORD").expect("SMTP_PASSWORD must be set");
    let from_email = env::var("FROM_EMAIL").expect("FROM_EMAIL must be set");
    let frontend_url = env::var("FRONTEND_URL").expect("FRONTEND_URL must be set");

    // Firebase configuration (optional)
    let firebase_service = if let Ok(service_account_path) = env::var("FIREBASE_SERVICE_ACCOUNT") {
        match FirebaseService::new(&service_account_path).await {
            Ok(service) => {
                println!("Firebase service initialized successfully");
                Some(service)
            }
            Err(e) => {
                eprintln!("Failed to initialize Firebase service: {}", e);
                None
            }
        }
    } else {
        println!("Firebase configuration not found, running without Firebase support");
        None
    };

    // Connect to database
    let database = Database::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Initialize email service
    let email_service = EmailService::new(
        smtp_host,
        smtp_port,
        smtp_username,
        smtp_password,
        from_email,
    ).expect("Failed to initialize email service");

    // Initialize auth service
    let auth_service = web::Data::new(AuthService::new(
        database.clone(),
        &jwt_secret,
        email_service,
        firebase_service,
        frontend_url,
    ));

    println!("Starting server at http://{}:{}", host, port);

    // Start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(auth_service.clone())
            .configure(api::auth::config)
    })
    .bind((host, port))?
    .run()
    .await
}
