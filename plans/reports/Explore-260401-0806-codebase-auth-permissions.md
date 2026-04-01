# Codebase Exploration Report: Authentication, Permissions & Invitations

**Date**: 2026-04-01  
**Scope**: ProjectManager codebase structure, auth system, role/permission model, email capabilities

---

## 1. Project Tech Stack

### Frontend
- **Framework**: Next.js 14.1.0 (App Router)
- **Language**: TypeScript 5.2+
- **UI**: React 18.2.0 + Tailwind CSS 3.3.3
- **State Management**: Redux Toolkit 2.6.1, TanStack React Query 4.35.3
- **GraphQL**: Apollo Client 3.13.5
- **Authentication**: next-auth 4.24.11, Firebase 11.6.0
- **Rich Text**: TipTap 2.11.5
- **Deployment**: Vercel

### Backend (New Unified) - `/web/` directory
- **Framework**: Next.js 14.1.0 (API routes) + GraphQL Yoga 5.18.1
- **Language**: TypeScript 5.7.3
- **Database**: Supabase (PostgreSQL) + Supabase Auth
- **Server-side**: firebase-admin 13.7.0 for FCM
- **ORM/Query Builder**: Supabase JS SDK (type-safe)
- **Deployment**: Vercel (serverless)

### Backend (Current Production) - `/backend/` directory  
- **Language**: Rust
- **Framework**: Not a full backend; contains email/auth modules
- **Email**: Lettre SMTP + Handlebars templates
- **Auth**: JWT token handling

### Design Doc Service
- **Language**: Rust
- **Framework**: Actix-web
- **GraphQL**: async-graphql
- **DB**: SQLx with PostgreSQL

---

## 2. Authentication Flow

### Current Architecture (Multi-layer)

```
User Browser
    ↓
Frontend (Next.js 14)
    ├─ Supabase Auth (OAuth: Google, Email/Password)
    ├─ next-auth Session (optional legacy)
    └─ Firebase SDK (optional legacy)
    ↓
Backend API Routes (/api/auth/*)
    ├─ Supabase Auth tokens
    ├─ Firebase auth cookies
    └─ Custom session cookies
    ↓
GraphQL Yoga at /api/graphql
    └─ GraphQL Context (createContext @ lib/graphql/context.ts)
```

### Key Files - Authentication

| Path | Purpose |
|------|---------|
| `/web/src/contexts/AuthContext.tsx` | React context for auth state |
| `/web/src/types/auth.ts` | Auth interface definitions |
| `/web/src/lib/supabase/client.ts` | Supabase client setup |
| `/web/src/lib/supabase/server.ts` | Server-side Supabase clients |
| `/web/src/lib/supabase/middleware.ts` | Session/auth middleware |
| `/web/src/lib/graphql/context.ts` | **CRITICAL: Auth context creation** |
| `/web/src/app/api/auth/*` | Auth API routes (9 routes) |

### Auth Context Creation (Details)

**File**: `/web/src/lib/graphql/context.ts`

The context resolves user identity via:

1. **Supabase Auth** (primary):
   - Checks `supabase.auth.getUser()`
   - Resolves email → app `users.user_id` (UUID)
   - Note: Supabase auth UUID ≠ app user_id (foreign key)

2. **Firebase/Custom Cookies** (fallback):
   - Parses `user-session` and `auth-token` cookies
   - If user not found in DB, **auto-creates** user:
     - Generates username from email with conflict resolution
     - Uses timestamp suffix if username taken
     - Sets `display_name`, `full_name`, `name`
   - Resolves to app `users.user_id`

3. **Return Value**:
   ```typescript
   interface GraphQLContext {
     user: { id: string; email: string; name?: string } | null;
     supabase: SupabaseClient;
     supabaseAdmin: AdminClient;  // Uses SERVICE_ROLE_KEY
   }
   ```

---

## 3. Workspace/Project Permission Model

### Role Hierarchy

**4-tier System** (from `/web/src/types/members.ts`):

```
Manager   → Full control: add/remove members, change roles, edit project, manage tasks
Leader    → Manage tasks + members, view info, update progress
Member    → View info, create/edit tasks, update progress
Guest     → View-only access
```

### Database Schema - Project Members

**Table**: `project_members`

```sql
project_id    UUID (FK → projects)
user_id       UUID (FK → users)
role          VARCHAR (manager | leader | member | guest)
created_at    TIMESTAMP
-- joined_at, invitedBy fields exist in type definition but may need migration
```

### Permission Checking

**Location**: `/web/src/lib/services/member-service.ts`

```typescript
// Query user's role in a project
getMemberRole(supabase, projectId, userId): Promise<string | null>
  → SELECT role FROM project_members WHERE project_id = ? AND user_id = ?

// Get all members of a project
getMembers(supabase, projectId)
  → SELECT * FROM project_members WHERE project_id = ?
  → Joins with users table for full user details
```

### Role-based Mutations (GraphQL)

**File**: `/web/src/lib/graphql/resolvers/project.ts`

All mutations require authentication via `requireAuth(ctx.user)`:

| Mutation | Function | Role Check |
|----------|----------|-----------|
| `create_project` | Create project | None (any authenticated user) |
| `update_project` | Update project details | None enforced (should check owner) |
| `add_project_member` | Add member to project | None enforced (should check manager role) |
| `update_project_member` | Change member role | None enforced (should check manager role) |
| `remove_project_member` | Remove member | None enforced (should check manager role) |

**⚠️ CRITICAL FINDING**: Role-based permission checks are **NOT implemented** in resolvers. Only auth check (`requireAuth`) exists. Application relies on frontend validation.

---

## 4. Existing Invitation System

### Current Implementation

**Invitation Status**: PARTIAL / IMPLICIT

**What exists**:
- `ProjectMember` type has `invitedBy` field (from `/web/src/types/project.ts`):
  ```typescript
  invitedBy?: string;  // User ID of person who invited
  ```
- Members can be added via email: `ADD_PROJECT_MEMBER` mutation takes email input
- `addMember()` service creates project member directly

**What's MISSING**:
- ❌ No invitation token generation
- ❌ No pending invitations table
- ❌ No email sending to invited users
- ❌ No invitation expiry/acceptance flow
- ❌ No way to invite via link

### Add Member Flow (Current)

```
Frontend MembersTab.tsx
  ↓ (email + role input)
GraphQL: ADD_PROJECT_MEMBER(email, role)
  ↓
memberService.addMember()
  ↓ (direct insert)
INSERT INTO project_members (project_id, user_id, role)
  ↓
User immediately becomes member
```

**Problem**: User must already exist in `users` table. If not:
- Email validation fails
- OR user lookup returns null
- Need to verify exact behavior in graphql mutation handler

---

## 5. Email Sending Capabilities

### Email Service (Backend - Rust)

**Location**: `/backend/src/email/`

**Status**: Implemented but for verification/password reset only

**Setup**:
```rust
EmailService::new(
  smtp_host: String,
  smtp_user: String,
  smtp_pass: String,
  from: String,
) -> Result<Self>
```

**Methods**:
- `send_verification_email(to, token, frontend_url)` → HTML template
- `send_password_reset(to, token, frontend_url)` → HTML template
- Both use Handlebars templates from `/backend/src/email/templates/`

**Templates**:
- `verification.hbs` - Email verification link
- `password_reset.hbs` - Password reset link

**Transport**: Lettre SMTP (async)

### Email in New Backend (`/web/`)

**Status**: NOT IMPLEMENTED

- No `resend`, `sendgrid`, or `nodemailer` dependencies
- No email service in `/web/src/`
- No email routes in `/web/src/app/api/`
- firebase-admin included but for FCM (push notifications), not email

### Notification System (Existing)

**Database**: `notifications` table in Supabase

```sql
notification_id  UUID
user_id          UUID
project_id       UUID
sender_id        UUID
type             VARCHAR
reference_type   VARCHAR
reference_id     VARCHAR
message          TEXT
action           VARCHAR
metadata         JSONB
is_read          BOOLEAN
created_at       TIMESTAMP
```

**Methods**: In-app only; no email dispatch

---

## 6. Relevant File Paths Summary

### Authentication & Session
- `/web/src/contexts/AuthContext.tsx` - React auth context provider
- `/web/src/lib/supabase/server.ts` - Server client + admin client
- `/web/src/lib/supabase/middleware.ts` - Session refresh logic
- `/web/src/lib/graphql/context.ts` - **GraphQL user resolution**
- `/web/src/app/api/auth/` - 9 auth API routes
  - `/login`, `/register`, `/logout`, `/google`, `/firebase`, `/set-cookie`, `/set-token`, `/get-token`, `/resend-verification`

### Permissions & Members
- `/web/src/lib/services/member-service.ts` - Member CRUD (add/update/remove/get)
- `/web/src/lib/services/project-service.ts` - Project CRUD
- `/web/src/lib/graphql/resolvers/project.ts` - GraphQL mutations (no role checks!)
- `/web/src/types/members.ts` - MemberRole, Member types
- `/web/src/types/project.ts` - ProjectMember interface + role utilities
- `/web/src/components/project/MembersTab.tsx` - Frontend member management UI
- `/web/src/graphql/mutations/projectMembers.ts` - GraphQL mutations
- `/web/src/graphql/queries/projectMembers.ts` - GraphQL queries

### Database Types
- `/web/src/lib/supabase/types.ts` - Database type definitions (project_members, users, etc.)

### Email (Rust Backend)
- `/backend/src/email/mod.rs` - EmailService trait + implementation
- `/backend/src/email/templates.rs` - Template handling
- `/backend/src/email/templates/` - HTML templates

---

## 7. Database Schema (Relevant Tables)

### users
```sql
user_id        UUID PRIMARY KEY
email          VARCHAR UNIQUE
full_name      VARCHAR
name           VARCHAR
avatar_url     VARCHAR
firebase_uid   VARCHAR
supabase_uid   VARCHAR
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

### project_members
```sql
project_id     UUID FK → projects
user_id        UUID FK → users
role           VARCHAR (enum: manager|leader|member|guest)
created_at     TIMESTAMP
-- Optional fields for invitations:
-- joined_at    TIMESTAMP
-- invitedBy    UUID FK → users
```

### projects
```sql
project_id     UUID PRIMARY KEY
name           VARCHAR
description    TEXT
status         VARCHAR
owner_id       UUID FK → users
created_at     TIMESTAMP
updated_at     TIMESTAMP
priority       VARCHAR
visibility     VARCHAR
```

### notifications
```sql
notification_id  UUID PRIMARY KEY
user_id          UUID FK → users
project_id       UUID FK → projects
sender_id        UUID FK → users
type             VARCHAR
reference_type   VARCHAR
reference_id     VARCHAR
message          TEXT
action           VARCHAR
metadata         JSONB
is_read          BOOLEAN
created_at       TIMESTAMP
```

---

## 8. Key Findings & Gaps

### ✅ What's Implemented
1. **Auth**: Supabase Auth (OAuth + Email/Password) with fallback to Firebase cookies
2. **User Context**: GraphQL context resolves user identity and auto-creates missing users
3. **Role System**: 4-tier role hierarchy (Manager/Leader/Member/Guest)
4. **Member Management**: Add/update/remove members via GraphQL
5. **Email Service**: SMTP setup in Rust backend for verification/password reset
6. **Notifications**: In-app notification system (DB-backed)

### ⚠️ Gaps/Issues for Invitation System

1. **No Authorization in GraphQL Resolvers**
   - Mutations like `add_project_member`, `update_project_member`, `remove_project_member` don't check user's role
   - Only check: user must be authenticated (`requireAuth`)
   - **Need**: Add role checks (manager-only mutations)

2. **No Invitation Token/Flow**
   - No pending invitations table
   - No invite token generation/validation
   - Users added immediately as members (if email exists)
   - **Need**: Invitation model with tokens, expiry, acceptance workflow

3. **No Email Invitations**
   - New backend (`/web/`) has no email service
   - Would need to add email sending (Resend, SendGrid, or use Rust backend)
   - Templates needed for invitation emails

4. **User Resolution Issue**
   - Users must pre-exist in `users` table to be invited by email
   - Auto-creation only happens via Firebase cookie fallback
   - **Need**: Clarify user creation flow when inviting by email

5. **`invitedBy` Field Not Populated**
   - Schema includes `invitedBy` but mutations don't set it
   - No migration to add `joined_at`, `invitedBy` to project_members if missing

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Next.js 14 (React + TailwindCSS + Redux)         │
│ ├─ AuthContext (Supabase Auth)                             │
│ ├─ MembersTab Component (UI for member management)         │
│ └─ Apollo Client → GraphQL queries/mutations              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ API Routes: /api/auth/*, /api/graphql                      │
│ ├─ Auth API: login, register, logout, google, firebase    │
│ └─ GraphQL Yoga: Schema + Resolvers                        │
└────────────┬─────────────────────────────┬──────────────────┘
             │                             │
      GraphQLContext                       │
      (createContext)                      │
             │                             │
             ↓                             ↓
┌──────────────────────┐    ┌──────────────────────────────┐
│ Supabase Client      │    │ Supabase Admin Client        │
│ (User Session Auth)  │    │ (Service Role - all access)  │
└──────────┬───────────┘    └──────────┬───────────────────┘
           │                           │
           └───────────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ PostgreSQL (Supabase)│
                │ ├─ users             │
                │ ├─ projects          │
                │ ├─ project_members   │
                │ ├─ tasks             │
                │ ├─ notifications     │
                │ └─ ... (30+ tables)  │
                └──────────────────────┘
```

---

## 10. Recommendations for Invitation Implementation

### Phase 1: Role-Based Authorization (Foundation)
1. Add role checks to GraphQL mutations in `project.ts`
2. Create `requireRole(ctx, projectId, requiredRole)` utility
3. Apply to: add_project_member, update_project_member, remove_project_member

### Phase 2: Invitation Tokens (Database)
1. Create `project_invitations` table:
   ```sql
   invitation_id  UUID PRIMARY KEY
   project_id     UUID FK
   invited_email  VARCHAR
   invited_by     UUID FK → users
   role           VARCHAR
   token          VARCHAR UNIQUE
   status         VARCHAR (pending|accepted|expired)
   expires_at     TIMESTAMP
   created_at     TIMESTAMP
   ```
2. Create GraphQL mutations: `create_project_invitation`, `accept_invitation`

### Phase 3: Email Service (New Backend)
1. Add Resend/SendGrid SDK to `/web/package.json`
2. Create `/web/src/lib/email-service.ts`
3. Add API route: `/web/src/app/api/email/send-invitation` (or in GraphQL)
4. Create invitation email template (HTML)

### Phase 4: Invitation UI/Flow
1. Update MembersTab to support both direct add + send invitation
2. Create public accept-invitation page at `/invitations/[token]`
3. Show pending invitations list in MembersTab

---

## Summary

**Current State**: 
- ✅ Auth system (Supabase + Firebase)
- ✅ Basic member management (add/remove/update role)
- ⚠️ No role-based permission enforcement
- ❌ No invitation tokens or email flow

**To Build Invitations**: 
Need email service + invitation table + token validation + role checks in resolvers.

