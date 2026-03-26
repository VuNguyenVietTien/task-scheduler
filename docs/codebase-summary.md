# Codebase Summary

## Overview

ProjectManager is a distributed microservice system for task scheduling, project management, and design document collaboration. Built with modern web technologies, it comprises three main services: task-scheduler-backend (Node.js/TypeScript), task-scheduler-frontend (Next.js/React), and design-doc-service (Rust/Actix-web).

**Repository**: Multi-service monorepo at `/Users/TienVNV/Desktop/ProjectManager`
**Total Codebase**: 593 files, ~808K tokens, ~3M characters

## Service Architecture

### 1. Task Scheduler Backend
**Path**: `task-scheduler-backend/`
**Stack**: Node.js, Express.js, TypeScript, PostgreSQL, GraphQL

**Core Modules**:
- **src/graphql/**: GraphQL schema and resolvers for tasks, projects, users, members, notifications
- **src/db/**: Database models, queries, and services for business logic
  - Models: User, Project, Task, Member, Report, Comment, Notification
  - Services: TaskService, ProjectService, CommentService, NotificationService
  - Reports module with period-based metrics and calculations
- **src/auth/**: JWT authentication, password management, middleware, token service
- **src/api/**: REST endpoints for attachments, media uploads, task assignments
- **src/firebase/**: Firebase Cloud Messaging (FCM) integration
- **src/websocket/**: WebSocket handlers for real-time updates
- **src/email/**: Email templates and notification service

**Key Features**:
- Task and project CRUD operations
- Team management with role-based access (Manager/Leader/Member/Guest)
- Report generation with on-schedule %, delay %, rejected tasks metrics
- Real-time notifications via WebSocket and FCM
- Comment system with mentions
- Gantt chart data generation
- Member bulk operations and role management

**Database Tables**:
- tasks, projects, members (with role: manager|leader|member|guest)
- reports (with report_type, period_start_date, period_end_date, metrics)
- comments, notifications, attachments
- task_status, task_assignments

### 2. Task Scheduler Frontend
**Path**: `task-scheduler-frontend/`
**Stack**: Next.js 13+, React, TypeScript, Redux, Tailwind CSS, Apollo Client

**UI Sections**:
- **src/app/dashboard/**: Role-based dashboard with task overview
- **src/app/projects/**: Project list, detail view, task management
- **src/app/designs/**: Design document library and viewer (GraphQL integration)
- **src/app/auth/**: Login, registration, email verification
- **src/components/**: 50+ reusable components

**Reports System** (NEW):
- Daily, weekly, monthly, quarterly report views
- Modular components: daily-report-view, period-report-view, report-metrics-card
- Date range picker and plan selector dropdown
- Redux-based metrics calculation from task state
- No backend resolvers; frontend handles aggregation

**Key Components**:
- Task list, task detail (with editable actual_start_date/actual_end_date fields), task creation/edit forms
- Task detail modal triggered from KanbanBoard, Timeline, and TaskListView
- Gantt chart with responsive design and click-to-open-modal support
- Project sidebar with expandable tree navigation
- Reports dashboard with multiple time periods
- Design viewer with split-pane editor
- Real-time notification display

**State Management**: Redux store with slices for tasks, projects, users, reports, notifications

**Styling**: Tailwind CSS with custom theme configuration

### 3. Design Document Service
**Path**: `design-doc-service/`
**Stack**: Rust, Actix-web, async-graphql, SQLx, PostgreSQL

**Core Modules**:
- **src/graphql/**: Async GraphQL resolvers for design documents, screens, components, flows
- **src/db/**: Database models and queries for design management
- **src/api/**: REST endpoints for design operations
- **src/auth/**: JWT token validation and authentication middleware
- **src/firebase/**: Optional Firebase integration

**Database Tables**:
- systems, modules, design_documents, screens, components
- field_mappings (UI component to database column mappings)
- flows, flow_steps (business process diagrams with Mermaid)
- tags, entity_tags (flexible tagging)
- external_links (Figma, wireframe references)
- document_audit (change history and audit trail)

**Key Features**:
- SVG import from Figma and Google Stitch
- Design document CRUD with i18n support
- Component-to-database field mapping
- Business flow diagrams with Mermaid syntax
- Impact analysis for design changes
- Audit trail with complete change history
- Query caching for performance
- Batch operations for bulk imports

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js, React, TypeScript | UI and state management |
| Backend | Express.js, Node.js, TypeScript | API and business logic |
| Design | Rust, Actix-web, async-graphql | GraphQL API for design documents |
| Database | PostgreSQL (shared cluster) | Primary data store |
| Real-time | WebSocket, FCM | Live updates and notifications |
| Auth | JWT, bcrypt | Secure authentication |
| Styling | Tailwind CSS | Frontend styling |
| ORM/Query | GraphQL, SQL (SQLx) | Data access layer |

## Database Architecture

### Shared PostgreSQL Cluster
**Host**: postgres (Docker Compose)

**Databases**:
1. **task_scheduler** (task-scheduler-backend)
   - Tasks, projects, members with extended role system
   - Reports table with metrics tracking
   - Comments, notifications, attachments
   - Member roles: manager, leader, member, guest

2. **design_docs** (design-doc-service)
   - Design documents, screens, components
   - Flow diagrams and business processes
   - Audit trail and external links
   - Tags and categorization

**Key Indexes**:
- GIN indexes on JSONB fields for full-text search
- Indexes on frequently queried columns (system_id, module_id, created_by)
- Unique constraints on report period combinations

## Recent Changes (Report System Refactor, 2025-03-25)

### Role System
- **Manager**: Full control (was Admin)
- **Leader**: Manage tasks and team members (new)
- **Member**: Work on assigned tasks (same)
- **Guest**: View-only access (was Viewer)

### Reports Refactoring
- Modularized ReportView into component hierarchy
- Daily report bug fixes: date filtering, unassigned members, startedToday
- Added plan vs. actual comparison with dropdown selector
- Extended report types: daily, weekly, monthly, quarterly
- Frontend calculates metrics from Redux state (no backend resolvers)
- New database columns: rejected_tasks, on_schedule_percentage, delay_percentage
- Unique constraint on (report_type, period_start_date, period_end_date, project_id)

## Communication Patterns

```
Frontend (port 3000)
  ├─→ Backend (port 8080)
  │   └─→ PostgreSQL (shared)
  └─→ Design Service (port 8081)
      └─→ PostgreSQL (shared)
```

**Authentication**: JWT tokens with shared secret between services
**Data Flow**: REST/GraphQL for queries, WebSocket for real-time updates

## File Structure Highlights

### Frontend Component Organization
```
src/components/
├── common/ - Shared UI components
├── dashboard/ - Dashboard-specific components
├── projects/ - Project views and lists
├── tasks/ - Task management UI
├── reports/ - Report display components (modularized)
├── designs/ - Design document components
└── auth/ - Authentication UI
```

### Backend Structure
```
src/
├── graphql/ - Query and mutation resolvers
├── db/ - Database models and services
├── auth/ - JWT and authentication logic
├── api/ - REST endpoints
├── websocket/ - Real-time connection handlers
└── email/ - Email templates
```

## Development Workflow

**Local Development**: `docker-compose up` starts all services with hot-reload

**Testing**: Unit tests in each service with comprehensive coverage goals

**Deployment**: Docker containers managed via docker-compose, nginx reverse proxy

## Security Features

- JWT-based authentication with expiration
- SQL injection prevention via parameterized queries
- XSS protection in SVG handling
- CORS policies enforced
- Role-based access control (RBAC)
- Audit logging for all design changes
- Password hashing with bcrypt

## Performance Optimizations

- GraphQL query caching in design service
- Connection pooling via SQLx
- Pagination for large data sets
- Responsive CSS and lazy loading on frontend
- JSONB GIN indexes for fast document search
- Batch operations for bulk imports

## Known Development Status

**Completed**:
- Task scheduling core functionality
- Project and team management
- Reports system with role-based views
- Design document service and UI
- UI refactor with sidebar navigation
- FCM notifications and WebSocket updates

**In Progress**:
- Design service performance optimization
- Frontend design pages testing
- Reports metrics validation

**Planned**:
- Real-time design collaboration (WebSocket)
- AI-powered design analysis
- Component library versioning
- Advanced export formats
