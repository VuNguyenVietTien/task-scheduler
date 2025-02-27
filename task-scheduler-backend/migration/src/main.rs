use sea_orm_migration::prelude::*;
use dotenv::dotenv;

#[async_std::main]
async fn main() {
    dotenv().ok();
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = sea_orm::Database::connect(&db_url).await.unwrap();

    println!("Running migrations...");
    migration::Migrator::up(&db, None).await.unwrap();
    println!("Migrations completed successfully!");
}