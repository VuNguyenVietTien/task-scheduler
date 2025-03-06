use async_graphql::extensions::{Extension, ExtensionContext, NextExecute};
use async_graphql::Value;
use async_graphql::Variables;
use futures::future::BoxFuture;
use serde_json::json;

pub struct Logger;

#[async_trait::async_trait]
impl Extension for Logger {
    async fn execute(
        &self,
        ctx: &ExtensionContext<'_>,
        operation_name: Option<&str>,
        query: &str,
        variables: &Variables,
        next: NextExecute<'_>,
    ) -> async_graphql::Response {
        println!("\n=== GraphQL Request ===");
        println!("Operation: {}", operation_name.unwrap_or("None"));
        println!("Query: {}", query);
        println!("Variables: {}", json!(variables));
        println!("=====================\n");

        let response = next.run(ctx, operation_name, query, variables).await;

        println!("\n=== GraphQL Response ===");
        println!("{:#?}", response);
        println!("======================\n");

        response
    }
}