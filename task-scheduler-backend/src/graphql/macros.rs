/// Implements empty query resolver
#[macro_export]
macro_rules! impl_query_resolver {
    ($resolver:ident) => {
        #[derive(Default)]
        pub struct $resolver;

        #[async_graphql::Object]
        impl $resolver {}
    };
}

/// Implements empty mutation resolver
#[macro_export]
macro_rules! impl_mutation_resolver {
    ($resolver:ident) => {
        #[derive(Default)]
        pub struct $resolver;

        #[async_graphql::Object]
        impl $resolver {}
    };
}
