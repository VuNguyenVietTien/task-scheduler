# Task Scheduler Backend

A Rust-based backend for the task scheduling and project management system, built with:
- GraphQL API using async-graphql
- PostgreSQL database with SeaORM
- Supabase for file storage
- Authentication with JWT
- Real-time updates using WebSocket

## Prerequisites

- Rust (latest stable version)
- PostgreSQL (14.x or later)
- Node.js (for running migration scripts)
- Docker (optional, for containerized development)

## Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd task-scheduler-backend
```

2. Copy the environment template:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
- Set a secure `JWT_SECRET`
- Configure your PostgreSQL connection in `DATABASE_URL`
- Add your Supabase credentials

4. Create the database:
```bash
psql -U postgres
CREATE DATABASE task_scheduler;
```

5. Run database migrations:
```bash
cargo run --bin migration
```

6. Start the development server:
```bash
cargo run
```

The server will start at `http://localhost:8080` by default.

## Project Structure

```
src/
├── auth/             # Authentication and authorization
├── db/               # Database models and migrations
│   ├── entities/     # SeaORM entity definitions
│   └── migrations/   # Database migrations
├── graphql/          # GraphQL schema and resolvers
│   ├── resolvers/    # Query and mutation implementations
│   ├── types/       # GraphQL type definitions
│   └── dataloaders/ # Efficient data loading
├── error.rs         # Error handling
├── config.rs        # Configuration management
└── main.rs          # Application entry point
```

## Testing

Run the test suite:
```bash
cargo test
```

Run specific tests:
```bash
cargo test test_name
```

## GraphQL API

The GraphQL playground is available at `http://localhost:8080/graphql` when running in development mode.

### Key Queries
```graphql
query Me {
  me {
    id
    email
    name
    role
  }
}

query Tasks($projectId: ID!) {
  tasks(projectId: $projectId) {
    id
    title
    status
    priority
    assignees {
      name
    }
  }
}
```

### Key Mutations
```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    status
  }
}

mutation UpdateTaskStatus($taskId: ID!, $status: String!) {
  updateTaskStatus(taskId: $taskId, status: $status) {
    id
    status
  }
}
```

## Development Guidelines

1. Code Style
- Follow Rust standard formatting (use `cargo fmt`)
- Run `cargo clippy` to catch common mistakes
- Document public APIs using rustdoc

2. Error Handling
- Use the `AppError` type for error handling
- Provide descriptive error messages
- Handle all Result types appropriately

3. Database
- Add migrations for schema changes
- Use transactions for multi-step operations
- Write tests for database operations

4. Security
- Validate all user input
- Use prepared statements for database queries
- Keep dependencies updated

## Deployment

1. Build the release version:
```bash
cargo build --release
```

2. Run database migrations on the production database:
```bash
cargo run --bin migration -- up
```

3. Configure environment variables for production.

4. Start the server:
```bash
./target/release/task-scheduler-backend
```

## Docker Support

Build the Docker image:
```bash
docker build -t task-scheduler-backend .
```

Run the container:
```bash
docker run -p 8080:8080 --env-file .env task-scheduler-backend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
