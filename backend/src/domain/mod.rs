//! Domain layer: pure business rules plus transactional services.
//!
//! Modules here own behavior that must stay independent from GraphQL/HTTP
//! concerns. Task 1.1 introduces project taxonomy (phases/categories) and the
//! real-task hierarchy rules (design doc §4/§6).

pub mod taxonomy;
pub mod resource_identity;
