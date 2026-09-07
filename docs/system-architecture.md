# System Architecture

## Overview

The ProjectManager system is transitioning from a distributed microservice architecture to a unified Next.js serverless architecture on Vercel with Supabase backend. Current production uses multiple independent services (Node.js task-scheduler, Rust design-doc-service); the new `web/` codebase unifies both backends into GraphQL Yoga with Supabase.

**Migration Status**: New `web/` codebase built and tested; `frontend/` + Rust backends remain production until validation complete.

## System Components

### CURRENT (Production) — Microservice Architecture

### 0. Unified Backend (NEW - Planned Replacement)
- **Framework**: Next.js 14+ (TypeScript)
- **API Layer**: GraphQL Yoga at `/api/graphql`
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (serverless)
- **Auth**: Supabase Auth with Firebase OAuth bridge
- **Real-time**: Supabase Realtime (replacing custom WebSocket)
- **Storage**: Supabase Storage (replacing local file system)

**Key Features**:
- Unified GraphQL schema merging task-scheduler + design-doc domains
- 20+ service modules for Supabase queries
- 14 resolver files implementing both backends
- Single Apollo client on frontend (dual clients consolidated)
- Server-side Supabase client with service role key for API routes
- Middleware-based session refresh for auth
- FCM push via firebase-admin from serverless functions
- 10-second Hobby plan timeout (60s available on Pro)

**Status**: Build complete (`npm run build` passes); deployment validation pending

**Note**: This architecture replaces the two Rust microservices below. Existing production remains unchanged until `web/` is fully validated.

### 1. Task Scheduler Backend (CURRENT)
- **Language**: Node.js (TypeScript)
- **Framework**: Express.js
- **Port**: 8080
- **Database**: PostgreSQL (shared cluster)
- **Purpose**: Core task scheduling, project management, and business logic
- **Key Features**:
  - Task and project CRUD operations
  - Team and user management with role-based access control (Manager/Leader/Member/Guest)
  - Notification system with Firebase Cloud Messaging (FCM)
  - Gantt chart data generation
  - Real-time updates via WebSocket
  - Report generation with period-based metrics tracking

### 2. Design Document Service (CURRENT)
- **Language**: Rust
- **Framework**: Actix-web
- **Port**: 8081
- **Database**: PostgreSQL (dedicated schema in shared cluster)
- **Purpose**: Design document management with GraphQL API
- **Key Features**:
  - Design document CRUD operations
  - SVG paste from Figma/Google Stitch
  - Component-to-database field mapping
  - Business flow diagrams with Mermaid syntax
  - Impact analysis and change tracking
  - i18n description management
  - External link tracking
  - AI-readable export formats
  - Async GraphQL API with async-graphql + SQLx
  - JWT authentication (shared secret with task-scheduler)
  - Query caching and performance optimization

**Database Schema**:
- `systems`: Top-level organizational units
- `modules`: Sub-divisions within systems
- `design_documents`: Primary design document records
- `screens`: UI screen definitions with SVG and component references
- `components`: Reusable UI components with properties
- `field_mappings`: Component field to database column mappings
- `flows`: Business process flow definitions
- `flow_steps`: Individual steps in flows with Mermaid diagrams
- `tags`: Design document tags and categories
- `entity_tags`: Tag associations with documents/screens/components
- `external_links`: References to external resources (Figma, wireframes, etc.)
- `document_audit`: Change history and audit trail

### 3. Task Scheduler Frontend (CURRENT)
- **Language**: React + TypeScript
- **Framework**: Next.js 13+
- **Port**: 3000
- **Purpose**: Web UI for task scheduling and project management
- **Key Features**:
  - Dashboard and project views with role-based UI rendering
  - Task management interface
  - Gantt planning from the selected live or saved plan: one synchronized task hierarchy, allocation-only daily bars, and a member/day effort matrix using the same authoritative plan vectors
  - Real-time notifications
  - **Dual Apollo Clients**:
    - Primary client for task-scheduler-backend (port 8080)
    - Secondary isolated client for design-doc-service (port 8081)
    - Separate caching layers prevent GraphQL query conflicts
    - DocumentsTab component manages design-doc-service client lifecycle
  - **Reports System**:
    - Daily, weekly, monthly, quarterly report views
    - Date range picker for flexible report periods
    - Plan vs. actual comparison with plan selector dropdown
    - Metrics cards (on-time %, delay %, rejected tasks)
    - Redux-based metrics calculation from task state
  - **Documents Tab** (integrated in project detail sidebar):
    - Accessible from project sidebar navigation
    - Lists all design systems for current project
    - Create new design system interface
    - Uses isolated Apollo client to design-doc-service
  - **Design Document Pages** (integrated under `/designs/` routes):
    - `/designs`: Design document library
    - `/designs/[id]`: Design document detail view with split-pane design viewer
    - `/designs/new`: Create new design document with Figma/Google Stitch clipboard paste
    - `/designs/[id]/impact`: Impact analysis dashboard
  - **Design Components** (10+ components):
    - `design-viewer-split-pane`: Split view editor for design documents
    - `paste-design-zone`: Clipboard paste handler for SVG imports
    - `design-frame-interactive-svg`: Interactive SVG rendering with hotspots
    - Component mapping UI
    - Flow diagram renderer
    - Tag manager
    - Audit trail viewer
    - Impact analysis visualizer
    - Field mapping editor
    - External link manager

### Canonical project planning contracts

- Project membership has one writable base table, `project_members`; `resource_members` is a compatibility view. The migration is owned by `backend/migrations/20260907000001_consolidate_project_members.sql`.
- Account linking and project access are separate decisions: linking preserves the stable resource handle and assignments but grants no access role. See the member mutations under `backend/src/graphql/resolvers/resource_members/` and the management surface in `web/src/components/projects/SchedulingConfigPanel.tsx`.
- Tasks use one self-referential table. `parent_task_id` defines every descendant depth; the all-depth frontend owner is `web/src/redux/features/tasksSlice.ts`. List, report, overview, and dashboard totals count distinct descendants, while root pagination is labelled as root-only. Dashboard population reads authorized projects and each project's flat task rows rather than treating the root forest as a complete count.
- Per-project Progress type, Category, and Task type catalogs use stable item IDs plus multilingual labels. `backend/migrations/20260907000002_project_task_catalogs.sql` owns storage/backfill; catalog resolvers own authorization and ordering. Project Settings edits labels/order, while task create/update selectors persist IDs without using localized text as identity. Legacy scalar fields remain compatible.
- Excel hierarchy and selective clone behavior are owned by `web/src/components/tasks/TaskExcelGrid.tsx`, `TaskCloneDialog.tsx`, and `web/src/utils/cloneTask.ts`. Each requested copy is a separate tree containing the selected ancestor-closed descendants.
- Gantt labels, daily bars, and the member matrix consume the selected live/draft/saved plan allocation vectors. Master Schedule aggregates only direct positive daily allocations into ordered Progress type rows; missing historical classification stays explicitly unknown and WBS remains the task hierarchy. Navigation: `web/src/components/timeline/Timeline.tsx`, `PhaseScheduleRow.tsx`, `MemberDailyEffortMatrix.tsx`, and `web/src/utils/taskAllocations.ts`.

## Communication Patterns

### Inter-Service Communication
```
task-scheduler-frontend (Apollo 1: Main)
    ↓ (HTTP/REST + GraphQL)
├─→ task-scheduler-backend (port 8080)
│   └─→ PostgreSQL

task-scheduler-frontend (Apollo 2: Design)
    ↓ (HTTP/REST + GraphQL)
└─→ design-doc-service (port 8081)
    └─→ PostgreSQL (shared)
```

**Note**: Frontend maintains separate Apollo clients to avoid cache conflicts between services. DocumentsTab component instantiates its own ApolloProvider for design-doc-service queries.

### Authentication
- **Frontend-to-Backend**: Session cookies + JWT
- **Backend-to-Design Service**: HTTP with JWT (shared secret)
- **Frontend-to-Design Service**: Via proxied requests through backend
- **Design Service**: Validates JWT tokens signed with shared secret

### Data Flow
1. **Design Paste Workflow**:
   - User pastes SVG from Figma/Google Stitch in frontend
   - SVG sent to design-doc-service GraphQL mutation
   - Service parses and stores SVG, extracts components
   - Returns design document ID to frontend
   - Frontend displays in split-view editor

2. **Impact Analysis**:
   - Query design-doc-service for document change history
   - Analyze field mapping impact on database schema
   - Display affected tasks/projects in task-scheduler-backend
   - User can review and confirm changes

3. **Export Workflow**:
   - Design document exported in multiple formats:
     - AI-readable JSON/YAML for ML processing
     - GraphQL schema definitions
     - HTML/PDF preview
   - External links resolved and included

## Database Architecture

### Shared PostgreSQL Cluster
- **Host**: postgres (Docker Compose)
- **Databases**:
  - `task_scheduler`: Main application database (task-scheduler-backend)
    - Reports table with period_start_date, period_end_date, report_type, metrics
    - Member role enum: manager, leader, member, guest
  - `design_docs`: Design document schema (design-doc-service)
- **Connection**: Both services connect via SQLx/PostgreSQL drivers
- **Backup**: Automated backups to external storage

### Design Document Schema Indexes
- GIN indexes on JSONB fields for full-text search
- Indexes on frequently queried columns (system_id, module_id, created_by)
- Performance optimized for large-scale design document queries

## Deployment Architecture

### Docker Compose
Services are containerized and managed via docker-compose.yml:
- `task-scheduler-backend`: Node.js container
- `design-doc-service`: Rust binary container
- `task-scheduler-frontend`: Next.js container
- `postgres`: PostgreSQL database
- `nginx`: Reverse proxy and load balancer

### Port Mappings
- 3000: Frontend (task-scheduler-frontend)
- 8080: Backend (task-scheduler-backend)
- 8081: Design Service (design-doc-service)
- 5432: PostgreSQL
- 80/443: Nginx (public routes)

## Scalability Considerations

1. **Design Service Scaling**:
   - GraphQL query caching reduces database load
   - Async handlers for long-running operations
   - Connection pooling via SQLx

2. **Frontend Assets**:
   - Static assets cached via nginx
   - Design SVG rendering optimized for performance
   - Pagination for large document lists

3. **Database Performance**:
   - Query optimization for complex impact analysis
   - Batch operations for bulk imports
   - Archive tables for old audit records

## Security Architecture

1. **API Authentication**:
   - JWT tokens with expiration
   - Shared secret between backend and design service
   - CORS policies enforced

2. **Data Protection**:
   - SQL injection prevention via parameterized queries (SQLx)
   - XSS protection in SVG handling
   - CSRF tokens for state-changing operations

3. **Access Control**:
   - Role-based access to design documents
   - Audit logging for all changes
   - User-scoped data isolation

## Development Workflow

1. **Local Development**:
   ```bash
   docker-compose up
   ```
   Starts all services with hot-reload support

2. **Service Integration**:
   - Frontend calls design-doc-service via backend proxy
   - Or direct frontend-to-service calls with CORS
   - Shared PostgreSQL for transactional consistency

3. **Testing**:
   - Unit tests for each service
   - Integration tests for design workflows
   - E2E tests for full feature flows

## Future Enhancements

- Real-time design collaboration (WebSocket)
- AI-powered design analysis
- Component library versioning
- Design system integration
- Advanced export formats (code generation)
- Performance monitoring and analytics
