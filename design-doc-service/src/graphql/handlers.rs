use actix_web::{web, HttpRequest, HttpResponse, Result};
use async_graphql::http::GraphiQLSource;
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};

use crate::auth::middleware::extract_claims;
use crate::config::Config;
use crate::graphql::{context::GqlContext, schema::AppSchema};

pub async fn graphql_handler(
    schema: web::Data<AppSchema>,
    req: HttpRequest,
    gql_req: GraphQLRequest,
    pool: web::Data<sqlx::PgPool>,
    config: web::Data<Config>,
) -> Result<GraphQLResponse> {
    let claims = extract_claims(&req, &config.jwt_secret);
    let ctx = GqlContext::new(pool.get_ref().clone(), claims, config.get_ref().clone());
    let request = gql_req.into_inner().data(ctx);
    let response = schema.execute(request).await;
    Ok(response.into())
}

pub async fn graphql_playground() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(
            GraphiQLSource::build()
                .endpoint("/graphql")
                .finish(),
        ))
}

pub async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}
