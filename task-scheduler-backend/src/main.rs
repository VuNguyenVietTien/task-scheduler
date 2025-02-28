use actix_web::{web, App, HttpServer};
use dotenv::dotenv;
use sea_orm::Database;
use std::env;

mod api;
mod auth;
mod email;
mod firebase;

use api::auth::auth_routes;
use auth::AuthService;
use email::EmailService;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Set up logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    // Database connection
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = Database::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // SMTP settings
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".to_string());
    let smtp_username = env::var("SMTP_USERNAME").unwrap_or_else(|_| "".to_string());
    let smtp_password = env::var("SMTP_PASSWORD").unwrap_or_else(|_| "".to_string());
    let smtp_from = env::var("SMTP_FROM").expect("SMTP_FROM must be set");

    // JWT secret
    let jwt_secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set")
        .into_bytes();

    // Frontend URL
    let frontend_url = env::var("FRONTEND_URL").expect("FRONTEND_URL must be set");

    // Firebase service account
    let firebase_service = match env::var("FIREBASE_SERVICE_ACCOUNT") {
        Ok(service_account_path) => {
            Some(firebase::FirebaseService::new(service_account_path)
                .expect("Failed to initialize Firebase"))
        }
        Err(_) => None,
    };

    // Email service
    let email_service = match env::var("SMTP_HOST") {
        Ok(_) => EmailService::new(
            smtp_host,
            smtp_username,
            smtp_password,
            smtp_from,
        ).expect("Failed to create email service"),
        Err(_) => EmailService::new(
            "localhost".to_string(),
            "test".to_string(),
            "test".to_string(),
            "noreply@example.com".to_string(),
        ).expect("Failed to create email service"),
    };

    // Auth service
    let auth_service = web::Data::new(AuthService::new(
        db,
        jwt_secret,
        email_service,
        frontend_url,
    ));

    // Create a new database connection for the web server
    let server_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let server_db = Database::connect(&server_url)
        .await
        .expect("Failed to connect to database");
    let db_data = web::Data::new(server_db);

    let server = HttpServer::new(move || {
        App::new()
            .wrap(actix_cors::Cors::permissive()) // Configure CORS for development
            .configure(api::init)
            .app_data(db_data.clone())
            .app_data(auth_service.clone())
    })
    .bind(("127.0.0.1", 8080))?
    .run();

    println!("Server running at http://127.0.0.1:8080/");

    server.await
}
