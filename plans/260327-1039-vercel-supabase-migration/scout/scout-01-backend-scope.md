# Backend Scope Scout - Rust Migration to Node/TS

**Date:** 2026-03-27 | **Codebases:** backend + design-doc-service

---

## 1. GraphQL API - Main Backend

### Query Operations
- `project(project_id)` - Get single project
- `task(task_id)` - Get single task
- `user(user_id)` - Get single user
- `project_members(project_id)` - List project members
- `project_member(project_id, member_id)` - Get single member
- `notifications(limit?, offset?)` - List notifications
- `notification(id)` - Get single notification
- `notification_count()` - Get notification counts (total, unread)
- `get_project_plans(project_id)` - List plans for project
- `get_latest_project_plan(project_id)` - Get latest plan
- `get_plan(id)` - Get single plan

### Mutation Operations
- `create_project(input)` - Create new project
- `create_task(input)` - Create task
- `create_user(input)` - Create user
- `add_project_member(project_id, input)` - Add member to project
- `update_project_member(project_id, member_id, input)` - Update member role
- `remove_project_member(project_id, member_id)` - Remove member
- `create_notification(input)` - Create notification
- `mark_notification_as_read(notification_id)` - Mark single as read
- `mark_all_notifications_as_read()` - Mark all as read
- `create_plan(input)` - Create plan
- `update_plan(input)` - Update plan
- `delete_plan(id)` - Delete plan
- `set_plan_active(id)` - Set plan as active

---

## 2. REST API - Main Backend

### Auth Endpoints
- `POST /api/v1/auth/register` - User registration (email, password, name)
- `POST /api/v1/auth/login` - Email/password login
- `POST /api/v1/auth/firebase/login` - Firebase token auth
- `GET /api/v1/auth/verify-email/{token}` - Email verification
- `POST /api/v1/auth/request-password-reset` - Send reset email
- `POST /api/v1/auth/reset-password` - Reset password with token
- `POST /api/v1/auth/users/{user_id}/change-password` - Change password

### Content Endpoints
- `POST /api/v1/comments` - Create comment
- `PUT /api/v1/comments/{comment_id}` - Update comment
- `DELETE /api/v1/comments/{comment_id}` - Delete comment
- `POST /api/v1/attachments` - Upload attachment
- `DELETE /api/v1/attachments/{attachment_id}` - Delete attachment
- `POST /api/media/upload` - Upload media file
- `GET /api/media/{file_path:.*}` - Serve media file
- `POST /api/v1/logging` - Log entry

---

## 3. Database Models - Main Backend

**Core Entities:**
- `project` - Projects with status, priority, visibility, progress tracking
- `task` - Tasks with status, priority, dates, progress, assignments
- `task_status` - Task status definitions
- `user` - Users with auth (email, password, firebase_uid)
- `member` - Project members with roles and join dates
- `comment` - Task comments with mentions
- `notification` - User notifications (unread tracking)
- `bug` - Bug tracking entity
- `report` - Report entity
- `report_task` - Task-report relationships

**Query Modules:**
- `task.rs` - Task CRUD + filtering
- `project.rs` - Project CRUD + visibility/access control
- `user.rs` - User lookup, auth
- `member.rs` - Member management, role checks
- `comment.rs` - Comment CRUD, mentions
- `notification.rs` - Notification CRUD, read status
- `task_status.rs` - Status definitions

---

## 4. WebSocket - Real-time Features

**Functionality:**
- `NotificationBroadcaster` - Broadcast channel (capacity configurable)
- `WebSocketState` - Manages active connections (add/remove/check/list users)
- `NotificationMessage` - Message struct (id, user_id, type, content, created_at)
- `connection.rs` - Connection handler logic
- `message.rs` - Message protocol definitions
- Ping/pong support, text/binary messaging

**Use Case:** Real-time notification delivery to connected clients

---

## 5. Auth System

**Mechanism:**
- JWT token-based + password hashing
- Firebase integration for OAuth
- Email verification flow
- Password reset with tokens
- Session middleware (auth_common, middleware.rs)

**Key Files:**
- `jwt.rs` - Token generation/validation
- `service.rs` - AuthService (register, login, verify_email, reset_password, change_password)
- `password.rs` - Bcrypt hashing
- `token.rs` - Token utilities
- `middleware.rs` - Request authentication
- `firebase.rs` - Firebase service (token verification)

---

## 6. GraphQL API - Design Doc Service

### Query Operations
- `modules(system_id)` - List modules
- `module(id)` - Get single module
- `documents(module_id)` - List documents (via Module.documents resolver)
- `screens(document_id)` - List screens (via Document.screens resolver)
- `components(screen_id)` - List components
- `flows(document_id)` - List design flows
- `tags(entity_type, entity_id)` - Get tags for entities
- `external_links(document_id)` - List external links
- `system(id)` - Get system (design system metadata)
- Impact analysis & field mappings (implied)

### Mutation Operations
- `create_module(input)` - Create module in system
- `update_module(input)` - Update module
- `create_document(input)` - Create design document
- `update_document(input)` - Update document
- `create_screen(input)` - Create screen
- `update_screen(input)` - Update screen
- `create_component(input)` - Create component
- `update_component(input)` - Update component
- `create_flow(input)` - Create design flow
- `update_flow(input)` - Update design flow
- `create_tag(input)` - Create tag
- `create_external_link(input)` - Create external link

---

## 7. Database Models - Design Doc Service

**Core Entities:**
- `system` - Design systems
- `module` - System modules/sections
- `document` - Design documents (status tracking, audit trail)
- `screen` - Screens within documents
- `component` - Reusable components
- `field_mapping` - Component field mappings
- `flow` - User flows / interactions
- `tag` - Entity tagging (multi-entity support)
- `audit` - Document audit trail / version history
- `external_link` - Links to external resources

**Key Features:**
- Audit trail for documents (entity_type, entity_id, action, old_data, new_data, changed_by)
- Metadata as JSON on entities
- Relationship tracking (module→document→screen→component)

---

## Summary

**Total GraphQL Operations:** ~30 queries + ~25 mutations
**Total REST Endpoints:** ~14 endpoints (mostly auth, media, comments)
**Total Database Models:** 10 (main) + 10 (design-doc-service)
**Real-time Layer:** WebSocket notification broadcaster
**Auth Mechanisms:** JWT + Firebase + Email verification + Password reset

**Complexity Factors:**
- Nested data relationships (project→members, document→screens→components)
- Audit/version history in design-doc-service
- Role-based access control (members with roles)
- Real-time notification system
- File upload/media serving
- Multi-entity tagging system

