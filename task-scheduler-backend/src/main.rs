mod auth;
mod config;
mod db;
mod error;
mod graphql;
mod utils;
mod websocket;

use actix_cors::Cors;
use actix_web::{guard, web, App, HttpServer};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use dotenv::dotenv;
use sqlx::postgres::PgPool;
use std::sync::Arc;
use std::time::Duration;

use crate::{
    config::Config,
    graphql::schema::{create_schema, AppSchema},
    websocket::{ws_connect, NotificationBroadcaster},
};

async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

async fn graphql_playground() -> actix_web::Result<actix_web::HttpResponse> {
    Ok(actix_web::HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(playground_source(
            GraphQLPlaygroundConfig::new("/graphql").subscription_endpoint("/ws"),
        )))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let config = Config::from_env().expect("Failed to load config");
    let addr = format!("{}:{}", config.server_host, config.server_port);

    // Database connection
    let db = Arc::new(PgPool::connect(&config.database_url)
        .await
        .expect("Failed to connect to database"));

    // Setup schema
    let schema = create_schema();

    // Setup notification broadcaster 
    let broadcaster = Arc::new(NotificationBroadcaster::new(100));

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(schema.clone()))
            .app_data(web::Data::new(Arc::clone(&broadcaster)))
            .app_data(web::Data::new(config.clone()))
            .service(
                web::resource("/graphql")
                    .guard(guard::Post())
                    .to(graphql_handler),
            )
            .service(
                web::resource("/playground")
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
