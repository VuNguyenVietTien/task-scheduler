# Project API Endpoints

## Project Routes
All routes are prefixed with `/api` by mod.rs

### Project Details
- `GET /projects/{id}` -> projects.rs
  - Fetch project details
  - Protected by Auth middleware

### Tasks
- `GET /projects/{id}/tasks` -> tasks.rs
  - List all tasks for a project
  - Route defined in tasks.rs without /api prefix
  - Protected by Auth middleware

### Members
- `GET /projects/{id}/members` -> project_members.rs
  - List all members for a project 
  - Route defined in project_members.rs without /api prefix
  - Protected by Auth middleware

## Route Structure
```
/api (mod.rs)
  ├── /auth/** (auth.rs, no Auth middleware)
  ├── /logging/** (logging.rs, no Auth middleware)
  └── /** (with Auth middleware)
      ├── /projects/{id} (projects.rs)
      ├── /projects/{id}/tasks (tasks.rs)
      └── /projects/{id}/members (project_members.rs)
```

## Authentication
All routes except /auth and /logging are protected by Auth middleware.

## Frontend Integration
- useProjectTasks hook uses `/api/projects/{id}/tasks`
- useProjectMembers hook uses `/api/projects/{id}/members`
- Both use common API configuration:
  - credentials: 'include'
  - proper error handling
  - caching with staleTime: 30s
  - disabled refetchOnWindowFocus

## Logging
- Frontend logs all API requests and responses
- Backend has comprehensive logging at all steps:
  - Request received
  - Auth validation
  - Database operations
  - Response sent