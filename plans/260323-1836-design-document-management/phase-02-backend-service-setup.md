# Phase 02: Backend Service Setup

## Context Links
- [Scout: Backend Architecture](scout/scout-01-codebase-report.md#1-backend-architecture)
- [Phase 01: DB Schema](phase-01-database-schema-and-migrations.md)

## Overview
- **Priority**: P1 (blocks all backend work)
- **Status**: completed
- **Effort**: 5h
- Scaffold Rust microservice with Actix-web, async-graphql, SQLx. Mirror existing task-scheduler patterns for consistency. JWT validation middleware (tokens from existing auth service).

## Key Insights
- Existing backend uses Actix-web 4.3.1 + async-graphql 5.0.10 + SQLx 0.7.4
- JWT tokens contain: user_id, email, username, role, exp
- DataLoader pattern used for N+1 prevention
- No subscriptions yet (EmptySubscription) - same approach for now

## Requirements

### Functional
- GraphQL API endpoint at `/graphql`
- JWT token validation (verify signature, not issue tokens)
- Health check endpoint at `/health`
- Database connection pool via SQLx
- CORS configuration for frontend access

### Non-Functional
- Docker container for deployment
- Environment-based configuration
- Structured logging (tracing crate)
- Graceful shutdown

## Architecture

### Project Structure
```
design-doc-service/
├── Cargo.toml
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── migrations/
│   └── (from Phase 01)
├── src/
│   ├── main.rs              # Server setup, middleware, routes
│   ├── config.rs             # Env var config struct
│   ├── auth/
│   │   ├── mod.rs
│   │   ├── jwt.rs            # JWT validation (verify only)
│   │   └── middleware.rs     # Actix middleware for auth
│   ├── graphql/
│   │   ├── mod.rs
│   │   ├── schema.rs         # AppSchema builder
│   │   ├── context.rs        # GraphQL context (db pool, user)
│   │   ├── handlers.rs       # HTTP handlers for /graphql
│   │   └── resolvers/
│   │       ├── mod.rs
│   │       ├── system.rs
│   │       ├── module.rs
│   │       ├── document.rs
│   │       ├── screen.rs
│   │       ├── component.rs
│   │       ├── flow.rs
│   │       └── tag.rs
│   ├── db/
│   │   ├── mod.rs
│   │   ├── models/           # SQLx FromRow structs
│   │   │   ├── mod.rs
│   │   │   ├── system.rs
│   │   │   ├── module.rs
│   │   │   ├── document.rs
│   │   │   ├── screen.rs
│   │   │   ├── component.rs
│   │   │   ├── flow.rs
│   │   │   ├── tag.rs
│   │   │   └── audit.rs
│   │   └── queries/          # SQL query functions
│   │       ├── mod.rs
│   │       └── (per-entity files)
│   ├── services/             # Business logic layer
│   │   ├── mod.rs
│   │   ├── document_service.rs
│   │   ├── figma_service.rs
│   │   └── impact_service.rs
│   └── error.rs              # Custom error types
```

### Key Dependencies (Cargo.toml)
```toml
[dependencies]
actix-web = "4.3"
actix-cors = "0.6"
async-graphql = { version = "5.0", features = ["uuid", "chrono"] }
async-graphql-actix-web = "5.0"
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
jsonwebtoken = "8.3"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
tracing-subscriber = "0.3"
dotenvy = "0.15"
reqwest = { version = "0.11", features = ["json"] }  # for external integrations (Jira/Trello)
```

### Config Struct
```rust
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub server_host: String,          // 0.0.0.0
    pub server_port: u16,             // 8081
    pub cors_origin: String,          // frontend URL
    pub task_scheduler_url: String,   // existing service URL
    pub max_svg_size: usize,          // max SVG content size (default 5MB)
}
```

## Related Code Files
- **Reference**: `task-scheduler-backend/src/main.rs` - server setup pattern
- **Reference**: `task-scheduler-backend/src/auth/jwt.rs` - JWT structure
- **Reference**: `task-scheduler-backend/src/config.rs` - config pattern
- **Create**: `design-doc-service/` - entire new service directory

## Implementation Steps
1. Initialize Cargo project: `cargo init design-doc-service`
2. Add all dependencies to Cargo.toml
3. Create `config.rs` with env var loading
4. Create `auth/jwt.rs` - JWT validation (decode + verify, same secret as task-scheduler)
5. Create `auth/middleware.rs` - Actix middleware extracting user from JWT
6. Create `db/models/` - SQLx FromRow structs matching Phase 01 schema
7. Create `graphql/context.rs` - Context holding PgPool + authenticated user
8. Create `graphql/schema.rs` - Empty query/mutation roots (resolvers added in Phase 03+)
9. Create `graphql/handlers.rs` - POST /graphql handler
10. Create `main.rs` - Server setup with middleware, CORS, DB pool, routes
11. Create `Dockerfile` and `docker-compose.yml`
12. Create `.env.example`
13. Test: `cargo build` + health check endpoint

## Todo List
- [x] Initialize Cargo project
- [x] Cargo.toml with all dependencies
- [x] Config from env vars
- [x] JWT validation middleware
- [x] SQLx DB pool setup
- [x] GraphQL schema skeleton
- [x] HTTP handlers (graphql, health)
- [x] main.rs server setup
- [x] Dockerfile
- [x] docker-compose.yml (service + postgres)
- [x] .env.example
- [x] Verify `cargo build` succeeds
- [x] Test health check endpoint

## Success Criteria
- `cargo build` compiles without errors
- `/health` returns 200 OK
- `/graphql` accepts POST with valid JWT → returns GraphQL response
- `/graphql` rejects requests without valid JWT → 401
- Docker container builds and runs

## Risk Assessment
- **JWT secret sharing**: Both services must use same JWT_SECRET. Mitigation: Shared env var / secrets manager.
- **SQLx compile-time checks**: Requires running DB during build. Mitigation: Use `sqlx prepare` for offline mode.
- **Version mismatch**: Must match existing service's JWT format exactly. Mitigation: Reference existing `auth/jwt.rs` implementation.

## Security Considerations
- JWT validation only (no token issuance)
- CORS restricted to frontend origin
- Database credentials via environment variables (never in code)
- No admin endpoints exposed

## Next Steps
- Phase 03: Add document CRUD resolvers to graphql schema
