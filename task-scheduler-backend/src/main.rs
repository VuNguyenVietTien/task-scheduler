use sea_orm::{Database, DbConn, EntityTrait, Set, ActiveModelTrait};
use dotenv::dotenv;
use entity::prelude::*;
use uuid::Uuid;
use std::time::Duration;
use chrono::{DateTime, Utc, FixedOffset};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = "postgres://postgres:cachiusa1A!@db.ucjwvxldtpgxkzehqwlz.supabase.co:5432/postgres";
    println!("Using database URL: {}", database_url);
    println!("Connecting to database...");
    
    let mut opt = sea_orm::ConnectOptions::new(database_url);
    opt.max_connections(1)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(10))
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(10))
        .max_lifetime(Duration::from_secs(10))
        .sqlx_logging(true);

    let db: DbConn = Database::connect(opt).await?;
    println!("Connected successfully!");

    let now: DateTime<Utc> = Utc::now();
    let fixed_now: DateTime<FixedOffset> = now.into();
    
    // Create a test user with new fields
    let user = entity::users::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set("test@example.com".to_string()),
        name: Set("Test User".to_string()),
        password_hash: Set("dummy_hash".to_string()),
        role: Set("MEMBER".to_string()),
        work_capacity: Set(Some(8.0)),
        email_verified: Set(false),
        verification_token: Set(Some("test_token".to_string())),
        verification_token_expires: Set(Some(fixed_now)),
        firebase_uid: Set(None),
        provider: Set("email".to_string()),
        created_at: Set(fixed_now),
        updated_at: Set(fixed_now),
        ..Default::default()
    };

    println!("Creating user...");
    let user = user.insert(&db).await?;
    println!("Created user: {:?}", user);

    // Query user
    let found_user = Users::find_by_id(user.id).one(&db).await?;
    println!("Found user: {:?}", found_user);

    Ok(())
}
