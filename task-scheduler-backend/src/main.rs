mod config;
mod graphql;
mod db;
mod api;
mod auth;
mod error;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenv::dotenv;
use log::info;

use crate::config::Config;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables
    dotenv().ok();
    
    // Initialize logging
    env_logger::init();
    
    // Load configuration
    let config = Config::from_env();
    
    info!("Starting server at {}:{}", config.host, config.port);
    
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
            // Add routes and middleware here
    })
    .bind((config.host, config.port))?
    .run()
    .await
}
