pub mod schema;
pub mod resolvers;
pub mod types;
pub mod dataloaders;

use async_graphql::{EmptySubscription, Schema};
use schema::{Mutation, Query};

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub fn create_schema(
    database: sea_orm::DatabaseConnection,
) -> AppSchema {
    Schema::build(Query::default(), Mutation::default(), EmptySubscription)
        .data(database)
        .finish()
}

pub mod context {
    use sea_orm::DatabaseConnection;
    use super::dataloaders::Loaders;
    use crate::auth::AuthUser;

    pub struct Context {
        pub db: DatabaseConnection,
        pub auth_user: Option<AuthUser>,
        pub loaders: Loaders,
    }

    impl Context {
        pub fn new(db: DatabaseConnection, auth_user: Option<AuthUser>) -> Self {
            Self {
                db: db.clone(),
                auth_user,
                loaders: Loaders::new(db),
            }
        }

        pub fn get_auth_user(&self) -> Option<&AuthUser> {
            self.auth_user.as_ref()
        }
    }
}
