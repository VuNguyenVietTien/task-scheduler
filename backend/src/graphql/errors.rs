use async_graphql::ErrorExtensions;

pub trait IntoGraphQLError {
    fn to_graphql_error(self) -> async_graphql::Error;
}

impl<E: std::error::Error> IntoGraphQLError for E {
    fn to_graphql_error(self) -> async_graphql::Error {
        async_graphql::Error::new(format!("{}", self)).extend_with(|_, e| {
            e.set("code", "INTERNAL_ERROR");
            e.set("details", format!("{:?}", self));
        })
    }
}
