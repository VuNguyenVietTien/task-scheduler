use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{
    guard,
    web::{self, Data},
    App, HttpResponse, HttpServer,
};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use sea_orm::{ConnectOptions, Database};
use tracing::info;

mod auth;
mod api;
mod config;
mod db;
mod email;
mod error;
mod firebase;
mod graphql;
mod session;
mod utils;
mod websocket;

use crate::{
    config::{get_config, CONFIG},
    graphql::create_schema,
};

pub async fn create_app() -> std::io::Result<()> {
    // Initialize configuration
    let config = get_config();

    // Initialize logging
    tracing_subscriber::fmt::init();

    // Database connection
    let mut opt = ConnectOptions::new(config.database_url.clone());
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(std::time::Duration::from_secs(8))
        .acquire_timeout(std::time::Duration::from_secs(8))
        .idle_timeout(std::time::Duration::from_secs(8))
        .max_lifetime(std::time::Duration::from_secs(8));

    let db = Database::connect(opt)
        .await
        .expect("Failed to connect to database");

    // Create schema
    let schema = create_schema();

    info!("Starting server at http://{}:{}", config.host, config.port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(Data::new(schema.clone()))
            .wrap(cors)
            .service(
                web::resource("/graphql")
                    .guard(guard::Post())
                    .to(graphql::schema::graphql_handler),
            )
            .service(
                web::resource("/playground")
                    .guard(guard::Get())
                    .to(graphql_playground),
            )
    })
    .bind((config.host.clone(), config.port))?
    .run()
    .await
}

async fn graphql_playground() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}