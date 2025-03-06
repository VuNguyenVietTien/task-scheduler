mod auth;
mod config;
mod db;
mod error;
mod graphql;
mod utils;
mod websocket;

use actix_cors::Cors;
use actix_web::{guard, web, App, HttpServer};
use dotenv::dotenv;
use sqlx::postgres::PgPool;
use std::sync::Arc;

use crate::{
    config::Config,
    graphql::{
        schema::create_schema,
        handlers::{graphql_handler, graphql_playground},
    },
    websocket::{ws_connect, NotificationBroadcaster},
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let config = Config::from_env().expect("Failed to load config");
    let addr = format!("{}:{}", config.server_host, config.server_port);

    // Database connection
    let pool = Arc::new(
        PgPool::connect(&config.database_url)
            .await
            .expect("Failed to connect to database"),
    );

    // Setup notification broadcaster
    let broadcaster = Arc::new(NotificationBroadcaster::new(100));

    println!("Starting server at http://{}", addr);

    // Create GraphQL schema with database pool and config
    let schema = web::Data::new(create_schema(pool.as_ref().clone(), config.clone()));

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(schema.clone())
            .app_data(web::Data::new(Arc::clone(&broadcaster)))
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
            .service(
                web::resource("/ws")
                    .guard(guard::Get())
                    .to(ws_connect),
            )
    })
    .bind(addr)?
    .run()
    .await
}
