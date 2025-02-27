mod auth;
mod api;

use actix_web::{web, App, HttpServer};
use actix_cors::Cors;
use dotenv::dotenv;
use sea_orm::Database;
use std::env;
use auth::AuthService;

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

    // Connect to database
    let database = Database::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Initialize auth service
    let auth_service = web::Data::new(AuthService::new(
        database.clone(),
        &jwt_secret,
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
