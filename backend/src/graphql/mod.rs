pub mod context;
pub mod resolvers;
// Tạm thời vô hiệu hóa import module types cho đến khi giải quyết xung đột
// giữa src/graphql/types.rs và src/graphql/types/mod.rs
// pub mod types;
// Sử dụng đường dẫn đầy đủ để tránh xung đột
pub mod dataloaders;
pub mod errors;
pub mod handlers;
pub mod macros;
pub mod schema;
#[path = "types/mod.rs"]
pub mod types_mod;

pub use context::Context;
pub use schema::AppSchema;

// Tạo alias để code hiện tại không bị lỗi
pub use types_mod as types;
