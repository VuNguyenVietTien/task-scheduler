# Scout Report: Task Scheduler Codebase Architecture

**Report Date:** 2026-03-23  
**Scope:** Backend (Rust) & Frontend (Next.js) Architecture Review  
**Purpose:** Establish baseline understanding for document management microservice design

---

## Executive Summary

Task Scheduler is a full-stack web application built with Rust (async-graphql) backend + Next.js (React) frontend, using PostgreSQL for persistence. Current tech stack supports project/task management with user authentication, comments, notifications, and basic file uploads. No dedicated document management system exists yet.

---

## 1. Backend Architecture

### 1.1 Tech Stack & Key Dependencies

**Framework & Runtime:**
- Actix-web 4.3.1 (HTTP server)
- Tokio 1.29.1 (async runtime)
- async-graphql 5.0.10 (GraphQL API layer)

**Database & ORM:**
- SQLx 0.7.4 (async SQL toolkit with postgres support)
- PostgreSQL (data persistence)
- Migrations: Custom SQL files in `migrations/` directory

**Authentication & Security:**
- jsonwebtoken 8.3.0 (JWT handling)
- bcrypt 0.10 (password hashing)
- actix-web-httpauth 0.8 (auth middleware)
- base64 0.22.1

**File Handling & Storage:**
- actix-multipart 0.6.0 (form-data parsing)
- async-std 1.13.1 (filesystem operations)

**Email & Notifications:**
- lettre 0.10.4 (SMTP email)
- Firebase integration (FCM notifications)

**Utilities:**
- serde/serde_json (serialization)
- chrono 0.4.26 (datetime handling)
- uuid 1.3.4 (unique identifiers)
- validator 0.16 (input validation)

### 1.2 Directory Structure

```
task-scheduler-backend/src/
├── main.rs              # Entry point, server setup, middleware config
├── lib.rs              # Public module exports
├── config.rs           # Configuration from env vars
├── auth/               # JWT, middleware, authentication service (10 files)
│   ├── jwt.rs
│   ├── service.rs
│   ├── middleware.rs
│   └── token.rs
├── graphql/            # GraphQL schema & resolvers (14 files)
│   ├── schema.rs       # Creates AppSchema from merged resolvers
│   ├── handlers.rs     # HTTP handlers for /graphql endpoint
│   ├── context.rs
│   ├── dataloaders.rs  # DataLoader for N+1 optimization
│   ├── resolvers/      # Domain-specific resolvers (17 files)
│   │   ├── project.rs      (480 lines) - Project CRUD + queries
│   │   ├── task.rs         (667 lines) - Task CRUD + complex queries
│   │   ├── user.rs         (245 lines) - User profile, auth mutations
│   │   ├── project_member.rs (316 lines) - Member management
│   │   ├── comment.rs/     - Comments on tasks
│   │   ├── notification.rs - Notification queries/mutations
│   │   ├── media_upload.rs - File upload simulation
│   │   ├── auth.rs         - Auth mutations (login, signup)
│   │   └── ... (9 more)
│   ├── types/          # GraphQL input/output types (12 files)
│   └── schema/         # Schema definitions
├── db/                 # Database layer (12 files)
│   ├── models/         - SQL models (11 files)
│   │   ├── project.rs
│   │   ├── task.rs
│   │   ├── user.rs
│   │   └── ... (8 more)
│   ├── queries/        - Database queries
│   ├── services/       - Business logic (plans.rs, etc.)
│   ├── types.rs        - Domain types
│   └── enums.rs        - Status/priority enums
├── entity/             # Entity definitions
├── api/                # REST API routes (10 files)
│   ├── routes.rs       - Route configuration
│   ├── media.rs        - Media endpoint handlers
│   ├── auth.rs         - Auth endpoints
│   └── ... (7 more)
├── firebase/           # Firebase service (2 files)
├── websocket/          # WebSocket support
├── email/              - Email service
├── session/            - Session management
├── error.rs            - Error types
└── utils/              - Utility functions
```

### 1.3 GraphQL Schema Overview

**Query Root (merged object):**
- `ProjectQuery` - Get projects, project details
- `TaskQuery` - Get tasks, task details
- `UserQuery` - Get user info, user list
- `CommentQuery` - Get comments for tasks
- `PlanQuery` - Get plans/reports
- `NotificationQuery` - Get user notifications
- `ProjectMemberQuery` - Get project members
- `MemberQuery` - Get member info

**Mutation Root (merged object):**
- `ProjectMutation` - Create/update/delete projects
- `TaskMutation` - Create/update/delete tasks
- `AuthMutation` - Login, signup, password reset
- `UserMutation` - Update profile
- `CommentMutation` - Add/update/delete comments
- `ProjectMemberMutation` - Add/remove members
- `MediaUploadMutation` - File upload (simulated)
- `PlanMutation` - Create/manage plans
- `NotificationMutation` - Mark notifications as read

**Subscriptions:** None currently (EmptySubscription)

### 1.4 Authentication & Authorization

**Approach:** JWT-based token authentication

**Components:**
- JWT generation/validation in `auth/jwt.rs`
- Middleware in `auth/middleware.rs` validates tokens on GraphQL requests
- User roles: `admin`, `user` (stored in `users.role` column)
- Project-level member roles: `admin`, `member`, `viewer` (in `project_members.role`)

**Token Fields:**
- `user_id`, `email`, `username`, `role`, `exp`
- Expiry: configurable via `JWT_EXPIRY` env var (default 24 hours)

**Verified Providers:**
- Email/password (bcrypt hashed)
- Google OAuth (`google_id` field)
- Firebase (`firebase_uid` field)

---

## 2. Database Schema

### 2.1 Current Tables (13 core + 6 support)

**Users & Access Control:**
- `users` - 29 cols: email, password_hash, firebase_uid, roles, verification tokens
- `project_members` - membership with roles & join dates

**Projects & Organization:**
- `projects` - 15 cols: name, description, owner_id, status, priority, visibility, progress
- `project_members` - role-based access control
- `task_statuses` - custom status definitions per project
- `tags` - project-specific tags

**Tasks & Work:**
- `tasks` - 19 cols: title, description, assignee_id, status, priority, dates, progress
- `task_tags` - many-to-many mapping
- `task_durations` - time tracking entries
- `task_snapshots` - historical snapshots from reports

**Collaboration:**
- `comments` - task comments with threading (parent_id)
- `comment_mentions` - mentions in comments

**File Management:**
- `attachments` - 10 cols: owner_type, owner_id, file_path, file_size, uploaded_by

**System:**
- `notifications` - user notifications with reference tracking
- `snapshots` - project state snapshots
- `activity_logs` - audit trail (project, task, user actions)

### 2.2 Key Relationships

```
users (1) ──────→ (n) projects (owner_id → project_id)
users (1) ──────→ (n) project_members (user_id → project_members.user_id)
projects (1) ────→ (n) tasks (project_id → task_id)
users (1) ───────→ (n) tasks (assignee_id → user_id)
tasks (1) ───────→ (n) comments (task_id → comment_id)
tasks (1) ───────→ (n) task_durations (task_id → duration_id)
projects (1) ────→ (n) attachments (project_id as owner_id)
tasks (1) ───────→ (n) attachments (task_id as owner_id)
```

### 2.3 Enums (PostgreSQL types)

- `project_status` - active, completed, on_hold, cancelled
- `project_priority` - low, medium, high, urgent
- `project_visibility` - public, private, team
- `task_status` - todo, doing, done, close, pending, review, blocked, rejected, archived
- `task_priority` - low, medium, high, urgent, critical
- `task_progress_type` - study, investigate, code, test, review_code, review_test_report, release
- `member_role` - admin, member, viewer
- `user_role` - admin, user
- `user_provider` - email, google, github

---

## 3. Frontend Architecture

### 3.1 Tech Stack & Key Dependencies

**Framework & Build:**
- Next.js 14.1.0 (React SSR/static generation)
- React 18.2.0
- TypeScript 5.2.2

**State Management & Data:**
- Apollo Client 3.13.5 (GraphQL client)
- Redux Toolkit 2.6.1 (app state)
- TanStack React Query 4.35.3 (server state caching)
- Zod 3.22.2 (TypeScript-first schema validation)

**UI Components & Styling:**
- Tailwind CSS 3.3.3 (utility-first CSS)
- Material-UI (@mui/material 6.4.8, @mui/icons-material 6.4.8)
- Radix UI primitives (accordion, select, tooltip)
- Headless UI (@headlessui/react 1.7.17)
- Heroicons (icon set)

**Rich Text & Tables:**
- Tiptap (editor): 2.11.5 + extensions (image, table, color, text-align, etc.)
- React Quill (editor alternative): 2.0.0 + custom modules
- @hello-pangea/dnd 18.0.1 (drag-drop)
- @dnd-kit/* (alternative drag-drop)

**Forms & Validation:**
- React Hook Form 7.54.2
- @hookform/resolvers 3.10.0

**File Upload:**
- apollo-upload-client 18.0.1 (Apollo middleware for file uploads)
- formidable 3.5.2 (form-data parsing)

**Notifications:**
- Firebase 11.6.0 (for push notifications)
- react-hot-toast 2.5.2 (toast UI)
- react-toastify 11.0.5 (toast notifications)
- Sonner 2.0.1 (toast alternative)

**Charting & Data Viz:**
- Recharts 2.9.0 (React charts)

**Utilities:**
- date-fns 4.1.0 (date manipulation)
- clsx 2.1.1 (className utility)
- tailwind-merge 1.14.0 (CSS class merging)
- uuid 11.1.0 (ID generation)

### 3.2 Directory Structure

```
task-scheduler-frontend/src/
├── app/                 # Next.js app router pages
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Homepage
│   ├── Providers.tsx    # Context providers
│   ├── dashboard/       - Dashboard pages
│   ├── projects/        - Project pages
│   ├── auth/            - Auth pages (login, signup)
│   └── api/             - API routes
├── components/          # Reusable React components (18 dirs)
│   ├── common/          - Common components (RichTextEditor, etc.)
│   ├── tasks/           - Task-specific components
│   ├── projects/        - Project-specific components
│   ├── ui/              - UI primitives (Dialog, Button, etc.)
│   ├── layout/          - Layout components
│   ├── rich-text-editor/- Editor handlers
│   └── ... (12 more)
├── graphql/             # GraphQL client setup (8 files)
│   ├── index.ts         - Exports
│   ├── mutations.ts     - Root mutations
│   ├── mutations/       - Mutation files (projects, tasks, etc.)
│   ├── queries/         - Query files (10+ files)
│   ├── schema.ts        - Apollo Link setup
│   └── types/           - GraphQL types
├── hooks/               # Custom React hooks (25 dirs)
├── lib/                 # Utility libraries (21 files)
├── services/            - Business logic (5 dirs)
├── contexts/            - React contexts
├── redux/               - Redux slices & store
├── providers/           - Context providers
├── types/               - TypeScript type definitions (14 files)
├── utils/               - Utility functions (5 dirs)
├── styles/              - Global styles
├── schemas/             - Zod validation schemas
├── data/                - Static data
└── middleware.ts        - Next.js middleware
```

### 3.3 GraphQL Client Configuration

**Apollo Client Setup:**
- Located in `src/graphql/schema.ts`
- Configured with upload link (apollo-upload-client) for file uploads
- Auth middleware adds JWT token to requests
- Cache management for optimistic updates

**Query/Mutation Organization:**
- Mutations split by domain: tasks.ts, projects.ts, projectMembers.ts, etc.
- Queries split by domain: tasks.ts, projects.ts, users.ts, etc.
- Fragment patterns for reusable GraphQL selections
- TanStack Query layer for additional caching/refetching

### 3.4 Routing & Pages

**App Router Structure:**
- `/` - Homepage/Dashboard
- `/auth/login` - Login page
- `/auth/signup` - Signup page
- `/projects` - Projects list/dashboard
- `/projects/[id]` - Project detail with tasks
- `/projects/[id]/tasks` - Task list view
- `/dashboard` - Main dashboard

---

## 4. File Upload & Media Handling

### 4.1 Current Implementation

**Backend (`media_upload.rs`):**
- GraphQL mutation: `uploadImage(input: MediaUploadInput!) → MediaUploadResponse`
- Simulated implementation (demo-only): doesn't actually persist to DB
- Stores files in `uploads/{year}/{month}/` directory structure
- File metadata: `MediaUploadEntity` with id, filename, mimetype, size, url, storage_path

**Frontend (`apollo-upload-client`):**
- Configured for Apollo Client to handle multipart/form-data
- File selection through standard form inputs
- Automatic serialization of files in mutations

**REST API Routes:**
- `/api/media/{id}` - Retrieve uploaded media
- File serving via Actix-web handlers

---

## 5. Authentication & Authorization Flow

### 5.1 Current Implementation

**Login Flow:**
1. Frontend POST to GraphQL: `login(email, password)` mutation
2. Backend validates credentials, generates JWT token
3. Token stored in HTTP-only cookie + localStorage (frontend decision)
4. Subsequent GraphQL requests include `Authorization: Bearer {token}` header
5. Middleware validates token signature & expiry

**Session Management:**
- JWT-based (stateless)
- Token expiry: 24 hours (configurable)
- No server-side session store (mentioned Redis config but not implemented)

**Multi-auth Support:**
- Email/password (primary)
- Google OAuth (oauth2 provider)
- Firebase Authentication

### 5.2 Authorization Patterns

**Project-level:**
- Member roles: admin (full access), member (edit), viewer (read-only)
- Project visibility: public (anyone), private (owner only), team (members only)

**Task-level:**
- Assignee can update task status/details
- Creator & project admins have full access
- Comments: any project member can comment

---

## 6. Notification System

### 6.1 Current Implementation

**Notifications Table:**
- `user_id`, `type`, `reference_type` (project/task), `reference_id`, `message`, `is_read`

**GraphQL API:**
- `getNotifications(userId)` - Query
- `markNotificationAsRead(notificationId)` - Mutation

**Firebase Integration:**
- FCM tokens stored (implied by `fcm_tokens` migration)
- Push notifications to mobile clients
- Service configured in `firebase/mod.rs`

**WebSocket Support:**
- NotificationBroadcaster in `src/websocket/`
- Real-time notification delivery (not fully integrated with GraphQL subscriptions)

---

## 7. Current Data Model Insights

### 7.1 How Projects are Modeled

**Core Attributes:**
- `id`, `name`, `description`
- `owner_id` (primary owner)
- `status` (active/completed/on_hold/cancelled)
- `priority` (low/medium/high/urgent)
- `visibility` (public/private/team)
- `progress` (float 0-100%)
- `start_date`, `end_date`
- `category`, `icon_url`
- `metadata` (JSONB for extensibility)
- `tags` (JSONB array)
- `created_at`, `updated_at`

**Project Membership:**
- Separate `project_members` table for role-based access
- Tracks join date, invited_by user, member role

### 7.2 How Tasks are Modeled

**Core Attributes:**
- `id`, `project_id`, `parent_task_id` (hierarchy)
- `title`, `description`
- `assignee_id` (single assignee)
- `status` (todo/doing/done/pending/review/blocked/archived)
- `priority` (5 levels: low/medium/high/urgent/critical)
- `progress` (float, manually set)
- `progress_type` (7 lifecycle stages: study/investigate/code/test/review_code/review_test_report/release)
- `priority_order` (integer for manual ordering)
- `start_date`, `due_date`, `actual_start_date`, `actual_end_date`
- `effort` (decimal estimate in hours/points)
- `type`, `category` (string fields)
- `tags` (JSONB array)
- `created_by`, `created_at`, `updated_at`

**Task Durations:**
- Separate table for time tracking
- Start/end datetime, status, note

---

## 8. Key Architectural Patterns

### 8.1 Backend Patterns

**GraphQL-First Architecture:**
- All business logic exposed via GraphQL mutations/queries
- No direct REST API for core operations (only media upload)
- Schema-driven API contracts

**DataLoader Pattern:**
- ProjectLoader, UserLoader for batch loading to avoid N+1 queries
- Integrated into async-graphql context

**Error Handling:**
- Custom error types in `error.rs`
- GraphQL error responses with detailed messages
- Validation at input level

**Async/Await:**
- Tokio runtime for concurrent request handling
- Database queries via SQLx (compiled query checks)

### 8.2 Frontend Patterns

**Apollo Client + React Query:**
- Apollo for GraphQL requests (mutations, queries)
- React Query for caching/syncing server state
- Redux for app-level UI state (sidebar, modals, etc.)

**Component Hierarchy:**
- Page components in `app/` (Next.js routes)
- Presentational components in `components/`
- Hooks for logic extraction (`hooks/` directory)

**Form Handling:**
- React Hook Form + Zod validation
- TipTap editor for rich text fields
- Drag-drop via dnd-kit for task ordering

---

## 9. Integration Points for Document Management

### 9.1 Relevant Existing Patterns

**File Upload:**
- MediaUploadMutation exists (simulated)
- apollo-upload-client configured
- Storage pattern: `uploads/{date}/` directory

**Metadata Storage:**
- JSONB fields on projects/tasks for extensibility
- Comment metadata support

**Relationships:**
- Comments already support task references
- Attachments table exists (owner_type/owner_id pattern)
- Activity logs track all changes

**Permissions:**
- Project member roles can restrict access
- User ownership tracking available

### 9.2 Missing Pieces

**No Document Entity:**
- Projects don't have dedicated "documents" collection
- No document versioning system
- No document workflow states

**No Collaboration Features:**
- No concurrent editing support (would need WebSocket)
- No change tracking/diffs
- No approval workflows

**No Content Types:**
- Only images supported (via media_upload)
- No PDF, Word, Markdown support
- No template system

---

## 10. Technology Summary Table

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend Framework** | Actix-web | 4.3.1 | HTTP server |
| **API Layer** | async-graphql | 5.0.10 | GraphQL schema |
| **Database** | PostgreSQL | 12+ (assumed) | Data persistence |
| **ORM/Query** | SQLx | 0.7.4 | Type-safe SQL |
| **Auth** | jsonwebtoken | 8.3.0 | JWT tokens |
| **File Handling** | actix-multipart | 0.6.0 | Form uploads |
| **Real-time** | WebSocket (Actix) | - | Notifications |
| **Email** | lettre | 0.10.4 | SMTP delivery |
| **Frontend Framework** | Next.js | 14.1.0 | React SSR |
| **GraphQL Client** | Apollo Client | 3.13.5 | API communication |
| **Form Library** | React Hook Form | 7.54.2 | Form handling |
| **Editor** | TipTap | 2.11.5 | Rich text editing |
| **Styling** | Tailwind CSS | 3.3.3 | Utility-first CSS |
| **State (UI)** | Redux Toolkit | 2.6.1 | Global UI state |
| **State (Server)** | React Query | 4.35.3 | Server data sync |

---

## 11. Unresolved Questions

1. **Document Storage Backend:**
   - Will documents be stored in PostgreSQL BYTEA, filesystem, or external service (S3, GCS)?
   - Size limits per document?
   - Storage quota per project?

2. **Document Versioning:**
   - Keep all versions or just last N?
   - Automatic snapshots or manual checkpoints?

3. **Collaboration Features:**
   - Will concurrent editing be supported?
   - If yes, which real-time sync mechanism (Yjs, ShareDB, etc.)?

4. **Supported Document Types:**
   - Which formats (PDF, Word, Markdown, Google Docs integration)?
   - Preview support requirements?

5. **Approval Workflow:**
   - Simple publish/draft states or complex approval chain?
   - Reviewer roles needed?

6. **Integration with Tasks/Projects:**
   - Documents belong to projects, tasks, or both?
   - Can documents link to multiple tasks?

7. **Access Control:**
   - Inherit from project member roles or separate document-level ACL?
   - Public document sharing links?

8. **Indexing & Search:**
   - Full-text search in document content?
   - Metadata indexing?

---

**Report Completed:** Scout phase analysis ready for Research & Design phases.

