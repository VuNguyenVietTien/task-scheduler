use sea_orm::{Database, DbConn, EntityTrait, Set, ActiveModelTrait};
use dotenv::dotenv;
use entity::prelude::*;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db: DbConn = Database::connect(database_url).await?;

    // Create a test user
    let user = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set("test@example.com".to_string()),
        name: Set("Test User".to_string()),
        password_hash: Set("dummy_hash".to_string()),
        role: Set("MEMBER".to_string()),
        work_capacity: Set(Some(8.0)),
        ..Default::default()
    };

    // Insert user
    let user = user.insert(&db).await?;
    println!("Created user: {:?}", user);

    // Query user
    let found_user = Users::find_by_id(user.id)
        .one(&db)
        .await?;
    println!("Found user: {:?}", found_user);

    Ok(())
}
