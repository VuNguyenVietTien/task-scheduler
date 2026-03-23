# Code Standards & Codebase Structure

## Repository Structure

```
ProjectManager/
├── task-scheduler-backend/          # Node.js Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── tests/
│   └── package.json
├── task-scheduler-frontend/         # Next.js React frontend
│   ├── src/
│   │   ├── app/                     # Next.js app directory
│   │   ├── components/              # React components
│   │   │   └── designs/             # Design-related components
│   │   ├── pages/                   # Page routes
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── services/                # API service layer
│   │   ├── graphql/                 # GraphQL queries and mutations
│   │   └── lib/                     # Utility functions
│   └── package.json
├── design-doc-service/              # Rust Actix-web service
│   ├── src/
│   │   ├── handlers/                # HTTP request handlers
│   │   ├── graphql/                 # GraphQL schema and resolvers
│   │   ├── models/                  # Database models
│   │   ├── db/                      # Database connection and queries
│   │   ├── middleware/              # Authentication, CORS, etc.
│   │   └── utils/                   # Helper functions
│   ├── migrations/                  # SQL migration files
│   ├── Cargo.toml
│   └── Dockerfile
└── docker-compose.yml               # Multi-container orchestration
```

## Naming Conventions

### JavaScript/TypeScript
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE (when used as module exports)
- **Functions**: camelCase (verbs: `getUser`, `fetchData`)
- **Classes**: PascalCase
- **Files**: kebab-case (e.g., `user-service.ts`, `auth-middleware.ts`)
- **Components**: PascalCase (e.g., `DesignViewer.tsx`)

### Rust
- **Variables**: snake_case
- **Constants**: UPPER_SNAKE_CASE
- **Functions**: snake_case
- **Structs/Enums**: PascalCase
- **Files**: snake_case (e.g., `user_service.rs`, `auth_handler.rs`)

### Database
- **Tables**: snake_case (plural, e.g., `design_documents`, `field_mappings`)
- **Columns**: snake_case (e.g., `created_at`, `system_id`)
- **Migrations**: YYYYMMDDHHMMSS_description.sql

## Code Organization Principles

### YAGNI (You Aren't Gonna Need It)
- Only implement features when needed
- Don't over-engineer solutions
- Prefer simple implementations over complex abstractions

### KISS (Keep It Simple, Stupid)
- Write clear, readable code over clever code
- Use standard patterns and conventions
- Avoid unnecessary complexity

### DRY (Don't Repeat Yourself)
- Extract common logic into reusable functions/modules
- Use inheritance and composition appropriately
- Avoid copy-paste code

## File Size Guidelines

- **TypeScript/JavaScript files**: Target < 200 lines
  - Split large files into focused modules
  - Extract shared logic to utils or services
- **Rust files**: Target < 300 lines (larger due to type system)
- **React Components**: Target < 150 lines
  - Extract custom hooks for logic
  - Create sub-components for UI sections

## TypeScript/JavaScript Standards

### Type Safety
```typescript
// Strict mode enabled in tsconfig.json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true
}
```

### File Organization
```typescript
// 1. Imports
import { Component } from 'react';

// 2. Types and interfaces
interface UserProps {
  name: string;
  email: string;
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Main function/component
export function User({ name, email }: UserProps) {
  // ...
}

// 5. Helper functions
function validateEmail(email: string): boolean {
  // ...
}
```

### API Response Handling
```typescript
// Always define response types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Handle errors explicitly
try {
  const response = await fetchData();
  return response.data;
} catch (error) {
  console.error('API Error:', error);
  throw new Error('Failed to fetch data');
}
```

## Rust Standards

### Project Structure
```rust
// src/main.rs - Entry point
// src/lib.rs - Library exports
// src/handlers/ - HTTP request handlers
// src/graphql/ - GraphQL schema and resolvers
// src/models/ - Domain models
// src/db/ - Database operations (SQLx queries)
// src/middleware/ - Request middleware
// src/utils/ - Helper functions
```

### Error Handling
```rust
// Use Result and custom error types
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Not found")]
    NotFound,
}

// Never unwrap() in production code
pub async fn get_document(id: i32) -> Result<Document, ServiceError> {
    // Use ? operator for error propagation
    let doc = sqlx::query_as::<_, Document>(...)
        .fetch_optional(&pool)
        .await
        .map_err(|e| ServiceError::Database(e.to_string()))?
        .ok_or(ServiceError::NotFound)?;
    Ok(doc)
}
```

### Async/Await
```rust
// Use async/await consistently
#[actix_web::get("/documents/{id}")]
pub async fn get_document(id: web::Path<i32>) -> impl Responder {
    // Handler implementation
}
```

## React Component Standards

### Functional Components
```typescript
interface ComponentProps {
  title: string;
  onAction: (id: string) => void;
}

export function MyComponent({ title, onAction }: ComponentProps) {
  const [state, setState] = React.useState(0);

  React.useEffect(() => {
    // Side effects
  }, []);

  return <div>{title}</div>;
}
```

### Custom Hooks
```typescript
// Extract reusable logic into custom hooks
export function useDesignDocument(id: string) {
  const [document, setDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Fetch logic
  }, [id]);

  return { document, loading };
}
```

## Testing Standards

### Unit Tests
- **Target Coverage**: > 80%
- **Framework**: Jest (Node.js), Vitest (Frontend)
- **Naming**: `function.test.ts` or `function.spec.ts`

### Test Structure
```typescript
describe('DesignService', () => {
  it('should create a design document', async () => {
    // Arrange
    const input = { title: 'Test Design' };

    // Act
    const result = await service.create(input);

    // Assert
    expect(result.id).toBeDefined();
    expect(result.title).toBe('Test Design');
  });
});
```

### Integration Tests
- Test database interactions
- Test API endpoints
- Use test databases (PostgreSQL with rollback)

## API Standards

### REST Endpoints
```
GET    /api/designs              - List all designs
POST   /api/designs              - Create design
GET    /api/designs/:id          - Get single design
PATCH  /api/designs/:id          - Update design
DELETE /api/designs/:id          - Delete design
```

### GraphQL Queries
```graphql
query GetDesignDocument($id: ID!) {
  designDocument(id: $id) {
    id
    title
    screens {
      id
      name
    }
  }
}
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2025-03-23T10:00:00Z"
  }
}
```

## Database Standards

### Migrations
- One feature per migration
- Use descriptive names: `20260323000001_create_design_documents.sql`
- Always include UP and DOWN migrations

### Queries
```sql
-- Use parameterized queries (SQLx handles this)
-- Good: $1, $2 placeholders
SELECT * FROM design_documents WHERE id = $1

-- Never concatenate strings
-- Bad: "SELECT * FROM design_documents WHERE id = " + id
```

## Security Standards

### Authentication
- JWT tokens for service-to-service communication
- Session cookies for frontend
- Shared secrets managed via environment variables

### Input Validation
```typescript
// Always validate and sanitize input
const schema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

const validated = schema.parse(input);
```

### CORS Configuration
```typescript
// Restrict to known origins
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};
```

## Error Handling

### Frontend
```typescript
try {
  const data = await api.fetchDesign(id);
  setDesign(data);
} catch (error) {
  console.error('Failed to load design:', error);
  setError('Failed to load design. Please try again.');
}
```

### Backend
```typescript
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message,
  });
});
```

## Commit Message Standards

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, missing semicolons)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Test additions or changes
- **chore**: Build process, dependencies

### Example
```
feat(design-service): add SVG import from Figma

- Parse Figma clipboard SVG format
- Extract component metadata automatically
- Store components in database

Closes #123
```

## Code Review Checklist

- [ ] Code follows naming conventions
- [ ] No unnecessary complexity
- [ ] Error handling implemented
- [ ] Tests included and passing
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Database migrations present
- [ ] Performance impact assessed

## Documentation Requirements

- JSDoc comments for public functions
- README in each service directory
- Inline comments for complex logic
- Architecture decisions documented
- API documentation (OpenAPI/GraphQL schema)
