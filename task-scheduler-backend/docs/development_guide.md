# Development Guide

This guide provides instructions for setting up and developing the Task Scheduler application.

## Prerequisites

- Rust (1.75 or later)
- Node.js (18.x or later)
- PostgreSQL (14.x)
- Docker and Docker Compose
- Git

## Development Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/organization/task-scheduler.git
cd task-scheduler
```

2. Set up environment variables:
```bash
# Backend
cp task-scheduler-backend/.env.example task-scheduler-backend/.env
# Edit .env with your local configuration

# Frontend
cp task-scheduler/.env.example task-scheduler/.env.local
# Edit .env.local with your local configuration
```

3. Start the development database:
```bash
docker-compose -f task-scheduler-backend/docker-compose.yml up -d db
```

4. Install dependencies and run migrations:
```bash
# Backend
cd task-scheduler-backend
cargo install sea-orm-cli
sea-orm-cli migrate up

# Frontend
cd ../task-scheduler
npm install
```

5. Start the development servers:
```bash
# Backend (in task-scheduler-backend directory)
cargo run

# Frontend (in task-scheduler directory)
npm run dev
```

## Project Structure

### Backend (Rust)

```
task-scheduler-backend/
├── src/
│   ├── auth/            # Authentication and authorization
│   ├── db/             # Database entities and migrations
│   ├── email/          # Email templates and sending
│   ├── graphql/        # GraphQL schema and resolvers
│   ├── tests/          # Test modules
│   └── websocket/      # WebSocket handling
├── deploy/             # Deployment configurations
└── docs/              # Documentation
```

### Frontend (Next.js)

```
task-scheduler/
├── src/
│   ├── app/           # Next.js app directory
│   ├── components/    # Reusable components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and helpers
│   ├── styles/        # Global styles
│   └── types/         # TypeScript type definitions
└── public/           # Static assets
```

## Development Workflow

1. **Branch Naming Convention**:
   - Feature: `feature/description`
   - Bug fix: `fix/description`
   - Documentation: `docs/description`
   - Refactor: `refactor/description`

2. **Commit Message Format**:
```
type(scope): description

[optional body]

[optional footer]
```
Example: `feat(auth): implement JWT refresh token mechanism`

3. **Code Style**:
   - Backend: Use `cargo fmt` and `cargo clippy`
   - Frontend: Use ESLint and Prettier

4. **Testing Requirements**:
   - Unit tests for all new features
   - Integration tests for API endpoints
   - E2E tests for critical flows
   - Run `cargo test` and `npm test` before committing

## GraphQL Development

1. **Adding a New Query/Mutation**:
```rust
// 1. Add to schema.graphql
type Query {
    newQuery: ReturnType!
}

// 2. Implement resolver
#[Object]
impl QueryRoot {
    async fn new_query(&self, ctx: &Context<'_>) -> Result<ReturnType> {
        // Implementation
    }
}
```

2. **Testing GraphQL Endpoints**:
   - Use GraphiQL at `http://localhost:8080/graphql`
   - Write tests using `async_graphql::Schema`

## Frontend Development

1. **Component Guidelines**:
   - Use TypeScript for all components
   - Implement proper error handling
   - Add loading states
   - Make components responsive
   - Document props with JSDoc

2. **State Management**:
   - Use React Query for server state
   - Use Context for global app state
   - Use local state for component-specific state

3. **Styling**:
   - Use Tailwind CSS for styling
   - Follow design system guidelines
   - Ensure mobile responsiveness

## Common Tasks

### Adding a New Feature

1. Create a new branch
2. Update schema if needed
3. Implement backend changes
4. Write backend tests
5. Implement frontend changes
6. Write frontend tests
7. Update documentation
8. Create pull request

### Database Changes

1. Create a new migration:
```bash
sea-orm-cli migrate generate migration_name
```

2. Apply migration:
```bash
sea-orm-cli migrate up
```

3. Update entity:
```bash
sea-orm-cli generate entity -o src/db/entities
```

### Running Tests

```bash
# Backend
cargo test                 # Run all tests
cargo test -- --nocapture # Run with output
cargo test test_name      # Run specific test

# Frontend
npm test                  # Run all tests
npm test -- --watch      # Run in watch mode
npm test filename        # Run specific test file
```

## Debugging

1. **Backend**:
   - Use `RUST_LOG=debug cargo run`
   - Add logging with `log::debug!`
   - Use VS Code debug configuration

2. **Frontend**:
   - Use React Developer Tools
   - Use browser console
   - Use debugger statement

## Performance Considerations

1. **Backend**:
   - Use DataLoader for N+1 queries
   - Implement caching where appropriate
   - Monitor query performance

2. **Frontend**:
   - Implement code splitting
   - Use proper memoization
   - Optimize images and assets

## Deployment

See [Deployment Guide](deployment_guide.md) for detailed deployment instructions.

## Troubleshooting

Common issues and solutions:

1. **Database Connection Issues**:
   ```
   Error: Database connection failed
   Solution: Check PostgreSQL service and credentials
   ```

2. **GraphQL Errors**:
   ```
   Error: Schema validation failed
   Solution: Ensure schema.graphql matches resolver implementations
   ```

3. **Frontend Build Issues**:
   ```
   Error: Type errors in build
   Solution: Run type-check and resolve TypeScript errors
   ```

## Getting Help

- Check existing documentation
- Search issue tracker
- Ask in team chat
- Contact project maintainers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Create pull request

Follow the [Contributing Guidelines](CONTRIBUTING.md) for detailed information.
