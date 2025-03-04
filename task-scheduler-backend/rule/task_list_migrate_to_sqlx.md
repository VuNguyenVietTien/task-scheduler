# Task List: Migrate from sea-orm to sqlx

## Completed Tasks
- [x] Update migrations for users and comments tables
- [x] Migrate auth module to use sqlx
- [x] Fix auth errors and middleware visibility
- [x] Migrate user resolver to use sqlx 
- [x] Migrate comment resolver to use sqlx
- [x] Add proper GraphQL derives for response types
- [x] Implement proper error handling

## Pending Tasks
- [ ] Migrate project resolver to use sqlx
- [ ] Migrate task resolver to use sqlx
- [ ] Migrate member resolver to use sqlx
- [ ] Add tests for new sqlx queries
- [ ] Update API documentation with new schema
- [ ] Remove sea-orm dependencies
- [ ] Validate all GraphQL queries still work
- [ ] Performance testing for new query implementations

## Implementation Notes
1. Query changes:
   - Use sqlx::query() with .bind() instead of query_as!()
   - Implement TryFrom for response types
   - Add proper error mapping

2. Error handling:
   - Use thiserror for domain errors
   - Map database errors to GraphQL errors
   - Ensure proper error messages

3. Schema updates:
   - Add missing columns (metadata, is_deleted, etc)
   - Update indexes for better performance
   - Keep existing foreign key constraints