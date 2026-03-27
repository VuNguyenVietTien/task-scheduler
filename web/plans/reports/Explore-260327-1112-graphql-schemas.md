# GraphQL Schema Exploration Report

**Date**: 2026-03-27 | **Project**: ProjectManager Rust Backend & Design Doc Service

## Executive Summary

This report documents the complete GraphQL type definitions, queries, and mutations across two Rust services:
1. **Backend Service** - Project & Task Management GraphQL API
2. **Design Doc Service** - Design System & Screen Management GraphQL API

---

## BACKEND SERVICE

### Root Path
`/Users/TienVNV/Desktop/ProjectManager/backend/src/graphql/`

### GraphQL Types

#### Project Hierarchy

**Project**
- `project_id: UUID` (PK)
- `name: String` (required)
- `description: Option<String>`
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- `priority: ProjectPriority` (enum: Low, Medium, High, Urgent)
- `visibility: ProjectVisibility` (enum: Public, Private, Team)
- `status: ProjectStatus` (enum: Active, Completed, OnHold, Cancelled)
- `tags: Option<Vec<String>>`
- `progress: f64` (0.0-1.0)
- `category: Option<String>`
- `metadata: Option<JSON>`
- `start_date: Option<NaiveDate>`
- `end_date: Option<NaiveDate>`
- `icon_url: Option<String>`
- `is_public: bool`
- `member_count: i64`
- `owner: User` (relationship)
- `created_by: Option<User>` (relationship)
- `user_role: Option<MemberRole>` (current user's role)
- `members: Vec<ProjectMember>` (relationship)

**ProjectMember**
- `role: MemberRole` (enum: Manager, Leader, Member, Guest)
- `joined_at: Option<DateTime<UTC>>`
- `user: User` (relationship)

**User**
- `user_id: UUID`
- `email: String`
- `username: Option<String>`
- `full_name: Option<String>`
- `avatar_url: Option<String>`

---

#### Task Hierarchy

**Task**
- `task_id: UUID` (PK)
- `project_id: UUID` (FK to Project)
- `parent_task_id: Option<UUID>` (self-referencing for subtasks)
- `title: String`
- `description: Option<String>`
- `status: TaskStatus` (enum: Todo, Doing, Done, Close, Pending, Review, Blocked, Rejected, Archived)
- `priority: TaskPriority` (enum: Low, Medium, High, Urgent, Critical)
- `priority_order: i32` (display ordering)
- `start_date: Option<DateTime<UTC>>`
- `due_date: Option<DateTime<UTC>>`
- `actual_start_date: Option<DateTime<UTC>>`
- `actual_end_date: Option<DateTime<UTC>>`
- `effort: Option<f64>` (estimated effort in hours or points)
- `progress: Option<f64>` (0.0-1.0)
- `progress_type: Option<TaskProgressType>` (enum: Study, Investigate, Code, Test, ReviewCode, ReviewTestReport, Release)
- `assignee: Option<Assignee>` (relationship)
- `created_by: UUID`
- `creator: Option<Assignee>` (relationship)
- `created_at: Option<DateTime<UTC>>`
- `updated_at: Option<DateTime<UTC>>`
- `is_deleted: Option<bool>`
- `type_: Option<String>` (task type)
- `category: Option<String>`
- `tags: Option<JSON>`
- `child_tasks: Option<Vec<Task>>` (relationship)

**Assignee**
- `user_id: UUID`
- `username: String`
- `avatar_url: Option<String>`
- `role: Option<String>`

---

#### Auth & User Management

**AuthResponse**
- `token: String` (JWT)
- `expires_in: i64` (seconds)
- `user: AuthUserResponse`

**AuthUserResponse**
- `id: String` (UUID)
- `email: String`
- `name: String`
- `role: String` (enum: "admin", "user")
- `verified: bool`

**AuthPayload**
- `access_token: String`
- `refresh_token: String`
- `user: User`

---

#### Comments

**CommentResponse**
- `id: ID` (UUID)
- `task_id: ID` (FK to Task)
- `user_id: ID` (FK to User)
- `content: String`
- `parent_comment_id: Option<ID>` (for replies)
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- `is_deleted: bool`

---

#### Notifications

**Notification**
- `notification_id: ID` (UUID)
- `user_id: ID` (FK to User)
- `project_id: Option<ID>` (FK to Project)
- `sender_id: Option<ID>` (FK to User)
- `type_: String` (notification type)
- `reference_type: String` (entity type: task, comment, project, etc.)
- `reference_id: ID` (entity ID)
- `message: String`
- `action: String`
- `metadata: JSON`
- `is_read: bool`
- `created_at: DateTime<UTC>`

**NotificationCount**
- `total: i64`
- `unread: i64`

---

### GraphQL Queries (Backend)

#### ProjectQuery
- `project(project_id: ID!) -> Project` - Get single project with full details
- `projects() -> Vec<Projects>` - Get all projects user is member of

#### TaskQuery
- `task(task_id: ID!) -> Option<Task>` - Get task with subtasks recursively
- `tasks(project_id: ID!) -> Vec<Task>` - Get all tasks in project
- `task_subtasks(task_id: ID!) -> Vec<Task>` - Get direct subtasks

#### CommentQuery
- `comment(id: ID!) -> Option<CommentResponse>` - Get single comment
- `task_comments(task_id: ID!) -> Vec<CommentResponse>` - Get all comments on task

#### PlanQuery
- `get_project_plans(project_id: String!) -> Vec<Plan>` - Get all plans for project
- `get_latest_project_plan(project_id: String!) -> Option<Plan>` - Get latest plan
- `get_plan(id: String!) -> Option<Plan>` - Get single plan by ID

#### NotificationQuery
- (Inferred from mutation patterns)

---

### GraphQL Mutations (Backend)

#### ProjectMutation
- `create_project(input: CreateProjectInput!) -> Project`
  - **Input fields**: name, description, priority, visibility, tags, status, category, start_date, end_date, icon_url, metadata
- `update_project(project_id: ID!, input: UpdateProjectInput!) -> Project`
  - **Input fields**: name, description, priority, visibility, category, start_date, end_date, icon_url, is_public, status, tags, metadata
- `add_project_member(input: AddProjectMemberInput!) -> ProjectMember`
  - **Input fields**: project_id, user_id, role
- `update_project_member(input: UpdateProjectMemberInput!) -> ProjectMember`
  - **Input fields**: project_id, user_id, role
- `remove_project_member(project_id: String!, user_id: String!) -> bool`

#### TaskMutation
- `create_task(input: CreateTaskInput!) -> Task`
  - **Input fields**: project_id, parent_task_id, title, description, status, priority, priority_order, start_date, due_date, effort, progress, assignee_id, type_, category, tags, progress_type
- `update_task(input: UpdateTaskInput!) -> Task`
  - **Input fields**: task_id, title, description, status, priority, priority_order, start_date, due_date, actual_start_date, actual_end_date, effort, progress, assignee_id, parent_task_id, type_, category, tags, progress_type, is_deleted
- `update_task_status(input: UpdateTaskStatusInput!) -> Task`
  - **Input fields**: task_id, status (validated: todo, doing, done, close, pending, review, blocked, rejected, archived)
- `update_task_effort(task_id: ID!, effort: f64) -> Task`
- `delete_task(task_id: ID!) -> bool`
- `reorder_tasks(input: ReorderTasksInput!) -> Vec<Task>`
  - **Input fields**: task_orders (array of {task_id, priority_order})

#### CommentMutation
- `create_comment(input: CreateCommentInput!) -> CommentResponse`
  - **Input fields**: task_id, content, parent_comment_id
- `delete_comment(comment_id: ID!) -> bool`

#### PlanMutation
- `create_plan(input: CreatePlanInput!) -> Plan`
  - **Input fields**: project_id, name, description, plan_data (tasks array)
- `update_plan(input: UpdatePlanInput!) -> Plan`
  - **Input fields**: id, name, description, is_active, plan_data

#### NotificationMutation
- (From patterns: likely mark_as_read, delete)

---

#### AuthMutation
- `register(input: RegisterInput!) -> AuthResponse`
  - **Input fields**: email, password, username (optional)
- `login(input: LoginInput!) -> AuthResponse`
  - **Input fields**: email, password

---

## DESIGN-DOC SERVICE

### Root Path
`/Users/TienVNV/Desktop/ProjectManager/design-doc-service/src/graphql/`

### GraphQL Types

#### System Hierarchy

**SystemType** (GraphQL output type)
- `id: UUID`
- `project_id: String` (reference to backend project)
- `name: String`
- `description: Option<String>`
- `metadata: JSON`
- `created_by: String` (user ID)
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- **Relationships**:
  - `modules: Vec<ModuleType>` (nested query)
  - `tags: Vec<TagType>` (nested query)

**ModuleType**
- `id: UUID`
- `system_id: UUID` (FK to System)
- `name: String`
- `description: Option<String>`
- `metadata: JSON`
- `created_by: String`
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- **Relationships**:
  - `documents: Vec<DocumentType>` (nested query)
  - `tags: Vec<TagType>` (nested query)

**DocumentType**
- `id: UUID`
- `module_id: UUID` (FK to Module)
- `name: String`
- `status: String` (draft, review, approved, archived)
- `description: Option<String>`
- `source_tool: Option<String>` (e.g., Figma)
- `last_imported_at: Option<DateTime<UTC>>`
- `metadata: JSON`
- `created_by: String`
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- **Relationships**:
  - `screens: Vec<ScreenType>` (nested query)
  - `tags: Vec<TagType>` (nested query)
  - `flows: Vec<FlowType>` (nested query)
  - `document_versions: Vec<DocumentVersionType>` (audit trail)
  - `external_links: Vec<ExternalLinkType>` (nested query)

**ScreenType**
- `id: UUID`
- `document_id: UUID` (FK to Document)
- `name: String`
- `svg_content: Option<String>` (SVG markup)
- `svg_layers: Option<JSON>` (layer structure)
- `frame_width: Option<i32>` (in pixels)
- `frame_height: Option<i32>` (in pixels)
- `content_type: String` (enum: "svg", "image")
- `breakpoint: String` (e.g., mobile, tablet, desktop)
- `sort_order: i32` (display order)
- `metadata: JSON`
- `created_at: DateTime<UTC>`
- `updated_at: DateTime<UTC>`
- **Relationships**:
  - `components: Vec<ComponentType>` (nested query)
  - `tags: Vec<TagType>` (nested query)

**ComponentType** (inferred)
- `id: UUID`
- `screen_id: UUID` (FK to Screen)
- `name: String`
- `component_type: String` (button, input, card, etc.)
- SVG position/size metadata
- **Relationships**:
  - `field_mappings: Vec<FieldMappingType>`

**FieldMappingType** (inferred)
- `id: UUID`
- `component_id: UUID`
- Links UI components to data models

**FlowType** (User interaction flows)
- `id: UUID`
- `document_id: UUID`
- Flow/navigation path definitions

**TagType** (Shared tagging system)
- `id: UUID`
- `name: String`
- Applied to: System, Module, Document, Screen, Component

**DocumentVersionType** (Audit trail)
- `id: i64`
- `entity_type: String` (document, screen, component)
- `entity_id: UUID`
- `action: String` (create, update, delete)
- `old_data: Option<JSON>`
- `new_data: Option<JSON>`
- `changed_by: i64` (user ID)
- `changed_at: DateTime<UTC>`

**ExternalLinkType** (Cross-references)
- Link to external resources (Jira, Figma, etc.)

---

### GraphQL Queries (Design Doc Service)

#### SystemQuery
- `systems(project_id: String!) -> Vec<SystemType>` - Get all systems for project
- `system(id: UUID!) -> Option<SystemType>` - Get single system

#### ModuleQuery
- (Likely) `modules(system_id: UUID!) -> Vec<ModuleType>`
- (Likely) `module(id: UUID!) -> Option<ModuleType>`

#### DocumentQuery
- `documents(module_id: UUID!) -> Vec<DocumentType>` - Get docs in module
- `document(id: UUID!) -> Option<DocumentType>` - Get single doc

#### ScreenQuery
- `screens(document_id: UUID!) -> Vec<ScreenType>` - Get screens in doc
- `screen(id: UUID!) -> Option<ScreenType>` - Get single screen

#### ComponentQuery
- (Inferred) `components(screen_id: UUID!) -> Vec<ComponentType>`

#### TagQuery
- (Inferred) Tag management/filtering queries

---

### GraphQL Mutations (Design Doc Service)

#### SystemMutation
- `create_system(input: CreateSystemInput!) -> SystemType`
  - **Input fields**: project_id, name, description
- `update_system(input: UpdateSystemInput!) -> SystemType`
  - **Input fields**: id, name (optional), description (optional)
- `delete_system(id: UUID!) -> bool`

#### ModuleMutation
- (Pattern-based inference):
  - `create_module(input: CreateModuleInput!) -> ModuleType`
  - `update_module(input: UpdateModuleInput!) -> ModuleType`
  - `delete_module(id: UUID!) -> bool`

#### DocumentMutation
- `create_document(input: CreateDocumentInput!) -> DocumentType`
  - **Input fields**: module_id, name, description
- `update_document(input: UpdateDocumentInput!) -> DocumentType`
  - **Input fields**: id, name (optional), description (optional), status (optional - draft/review/approved/archived)
- (Inferred) `delete_document(id: UUID!) -> bool`

#### ScreenMutation
- `create_screen(input: CreateScreenInput!) -> ScreenType`
  - **Input fields**: document_id, name, breakpoint, sort_order (optional)
- `update_screen(input: UpdateScreenInput!) -> ScreenType`
  - **Input fields**: id, name (optional), svg_content (optional), svg_layers (optional), frame_width (optional), frame_height (optional), content_type (optional)
- `paste_design(input: PasteDesignInput!) -> ScreenType` - Import design from external tool
  - **Input fields**: document_id, screen_name, svg_content, svg_layers, breakpoint, frame_width, frame_height, content_type (optional)

#### ComponentMutation
- (Inferred pattern):
  - `create_component(input: CreateComponentInput!) -> ComponentType`
  - `update_component(input: UpdateComponentInput!) -> ComponentType`
  - `delete_component(id: UUID!) -> bool`

#### FieldMappingMutation
- (Inferred) `create_field_mapping(...) -> FieldMappingType`

#### TagMutation
- (Inferred) Tag CRUD operations

---

## Key Enums & Constants

### TaskStatus Values
- `todo`, `doing`, `done`, `close`, `pending`, `review`, `blocked`, `rejected`, `archived`

### TaskPriority Values
- `low`, `medium`, `high`, `urgent`, `critical`

### TaskProgressType Values
- `study`, `investigate`, `code`, `test`, `review_code`, `review_test_report`, `release`

### ProjectStatus Values
- `active`, `completed`, `on_hold`, `cancelled`

### ProjectPriority Values
- `low`, `medium`, `high`, `urgent`

### ProjectVisibility Values
- `public`, `private`, `team`

### MemberRole Values
- `manager`, `leader`, `member`, `guest` (guests cannot be assigned tasks)

### UserRole Values
- `admin`, `user`

### DocumentStatus Values
- `draft`, `review`, `approved`, `archived`

### ScreenContentType Values
- `svg`, `image`

---

## Architecture Notes

### Backend Service
- **Framework**: async-graphql + Actix-web
- **Database**: PostgreSQL with SQLx
- **Auth**: JWT tokens in Authorization header
- **Context**: GraphQLContext carries DB pool, auth claims, dataloaders
- **Transactions**: Used in task creation for atomicity
- **Complex Queries**: Task/Project hierarchies with recursive CTEs

### Design Doc Service
- **Framework**: async-graphql
- **Database**: PostgreSQL with SQLx
- **Auth**: Same JWT-based auth pattern
- **Complex Objects**: Nested relationships (System -> Module -> Document -> Screen -> Component)
- **Audit Trail**: DocumentAudit table tracks all changes by entity & user
- **External Links**: System for cross-referencing (Figma, Jira, etc.)

### Data Flow
1. GraphQL request hits handler with Authorization header
2. JWT token validated, user context created
3. Resolver executes with pool + auth context
4. Complex objects lazily load nested relationships
5. Dataloaders prevent N+1 queries

---

## Unresolved Questions

1. **Circular references**: How are Project <-> User relationships handled in serialization?
2. **Real-time updates**: Is there WebSocket subscription support beyond HTTP GraphQL?
3. **Batch operations**: Are there batch mutations for updating multiple tasks/projects?
4. **Search/Filtering**: Are there search queries or advanced filter parameters?
5. **Pagination**: Do list queries support pagination (limit/offset/cursor)?
6. **Soft deletes**: Is deletion always soft-delete (is_deleted flag) or hard-delete?

---

**Report generated**: 2026-03-27 11:12
**Files analyzed**: 30+ GraphQL resolver & type files
