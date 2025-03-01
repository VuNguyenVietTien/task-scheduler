mod service;
mod error;
mod token;
#[cfg(test)]
mod tests;
pub mod middleware;

pub use service::AuthService;
pub use error::AuthError;
// Re-exported for use in API route configuration
pub use middleware::Auth; 

use entity::users::{
    Entity as Users, 
    Model as UserModel,
};
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
use chrono::Utc;

pub async fn find_by_email(
    db: &impl sea_orm::ConnectionTrait,
    email: &str,
) -> Result<Option<UserModel>, sea_orm::DbErr> {
    Users::find()
        .filter(entity::users::Column::Email.eq(email))
        .one(db)
        .await
}

pub async fn find_by_id(
    db: &impl sea_orm::ConnectionTrait,
    id: uuid::Uuid,
) -> Result<Option<UserModel>, sea_orm::DbErr> {
    Users::find()
        .filter(entity::users::Column::Id.eq(id))
        .one(db)
        .await
}

pub async fn verify_email_token(
    db: &impl sea_orm::ConnectionTrait,
    token: &str,
) -> Result<Option<UserModel>, sea_orm::DbErr> {
    let now = Utc::now();

    Users::find()
        .filter(entity::users::Column::VerificationToken.eq(token))
        .filter(entity::users::Column::VerificationTokenExpires.gt(now))
        .one(db)
        .await
}

pub async fn find_by_verification_token(
    db: &impl sea_orm::ConnectionTrait,
    token: &str,
) -> Result<Option<UserModel>, sea_orm::DbErr> {
    let now = Utc::now();

    Users::find()
        .filter(entity::users::Column::VerificationToken.eq(token))
        .filter(entity::users::Column::VerificationTokenExpires.gt(now))
        .one(db)
        .await
}
