mod auth;
mod config;
mod db;
mod error;
mod graphql;
mod services;

use actix_cors::Cors;
use actix_web::{guard, web, App, HttpServer};
use tracing_subscriber;

use crate::config::Config;
use crate::graphql::{
    handlers::{graphql_handler, graphql_playground, health_check},
    schema::create_schema,
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let config = Config::from_env().expect("Failed to load config");
    let addr = format!("{}:{}", config.server_host, config.server_port);

    let pool = sqlx::postgres::PgPool::connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Database connected");

    let schema = web::Data::new(create_schema(pool.clone(), config.clone()));
    let pool_data = web::Data::new(pool);
    let config_data = web::Data::new(config.clone());

    tracing::info!("Starting design-doc-service at http://{}", addr);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&config.cors_origin)
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(schema.clone())
            .app_data(pool_data.clone())
            .app_data(config_data.clone())
            .route("/health", web::get().to(health_check))
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
    })
    .bind(&addr)?
    .run()
    .await
}
