# Frontend Codebase Exploration Report

**Date:** 2026-03-28  
**Project:** ProjectManager Frontend Analysis  
**Focus:** Project listing, modals, GraphQL mutations, and create forms pattern

---

## 1. Project Type & Interface Definition

### File: `/Users/TienVNV/Desktop/ProjectManager/frontend/src/types/project.ts`

**ProjectData Interface (List Display):**
```typescript
id: string
name: string
description: string
dueDate: string
members: number
status: 'active' | 'completed' | 'on-hold'
```

**ProjectDetails Interface (Detail View):**
```typescript
id: string
name: string
description: string | null
startDate: string | null
endDate: string | null
priority: string
status: string
visibility: string
createdAt: string
updatedAt: string
ownerId: string
iconUrl: string | null
userRole?: MemberRole
```

**CreateProjectInput Interface:**
```typescript
name: string
description?: string
startDate?: string
endDate?: string
priority?: string
status?: string
visibility?: string
iconUrl?: string
```

**Member Roles:** Manager | Leader | Member | Guest

---

## 2. GraphQL Queries & Mutations

### Queries Location
**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/project.ts`

#### GET_USER_PROJECTS
Returns list of projects with:
- projectId, name, startDate, endDate, status, memberCount, progress, category, priority, visibility, iconUrl
- owner object with userId, email, username, fullName, avatarUrl

#### GET_PROJECT_BY_ID
Returns detailed project with:
- All fields from list query
- members array with role, joinedAt, and nested user object

### Mutations Location
**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/project.ts`

#### CREATE_PROJECT Mutation (ALREADY EXISTS)
```graphql
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) {
    projectId
    name
    description
    startDate
    endDate
    status
    priority
    visibility
    tags
    category
    metadata
    iconUrl
    isPublic
    createdAt
    owner {
      userId
      email
      username
      fullName
      avatarUrl
    }
  }
}
```

**Note:** CREATE_PROJECT mutation already exists in the codebase at `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/project.ts` (lines 70-96).

---

## 3. Project-Related Pages & Components

### Pages Structure
- **Main List:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/page.tsx`
  - Renders `ProjectList` component
  
- **Create Project:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/new/page.tsx`
  - Full-page form for creating new projects
  - Uses CREATE_PROJECT mutation
  - Validation via Zod schema
  
- **Project Detail:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/[id]/page.tsx`
  - Project detail page with tabs

### Components
**Location:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/projects/`

1. **ProjectList.tsx** (6.7 KB)
   - Uses `GET_USER_PROJECTS` GraphQL query
   - Grid layout (3 columns on large screens)
   - Shows: name, description, progress bar, status/priority badges, member count, visibility
   - Links to `/projects/new` for creating new projects
   - Empty state with CTA button

2. **ProjectForm.tsx** (10.9 KB)
   - Full project creation/edit form
   - Uses accordions to organize fields:
     - Basic Information (name, description)
     - Timeline (start/due dates)
     - Project Details (status, priority, category, visibility)
     - Additional Information (tags)
   - Makes POST/PUT requests to `/api/projects`

3. **ProjectDetailView.tsx** (13.3 KB)
   - Displays detailed project information
   - Shows members, documents, tasks

4. **MembersView.tsx** (29.8 KB)
   - Manages project members
   - Role management

---

## 4. Modal/Dialog Pattern Used

### Core Modal Component
**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/ui/Dialog.tsx`

**Uses Headless UI Dialog with Transitions**

```typescript
// Props
interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  preventBackdropClose?: boolean  // Prevent closing on backdrop/Escape click
}
```

**Features:**
- Built on `@headlessui/react` Dialog component
- Smooth enter/exit animations via Transition component
- Fixed backdrop with opacity
- Prevents body scroll when open
- Supports preventing backdrop closure

### Additional Modal Components

1. **ConfirmationModal.tsx** (115 lines)
   - Confirmation dialogs with destructive action support
   - Uses `@headlessui/react` Dialog
   - Props: isOpen, onClose, onConfirm, title, message, confirmLabel, cancelLabel, isDestructive
   - Red styling for destructive actions

2. **ConfirmDialog.tsx** (61 lines)
   - Alternative confirmation dialog
   - Uses Button component for consistency
   - Props: isOpen, onClose, onConfirm, title, description, confirmText, cancelText, variant

3. **TaskFilterModal.tsx** (200+ lines - example of complex modal)
   - Shows pattern for modals with multiple features
   - Tab-based interface
   - Local state management
   - LocalStorage integration for saved filters
   - Multiple action buttons (Apply, Reset, Save)

---

## 5. Create Form Patterns

### Full-Page Create Form Pattern

**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/new/page.tsx`

**Key Characteristics:**
1. Client component (`'use client'`)
2. Uses Zod schema validation (`validateProjectForm`)
3. Form state management with useState
4. GraphQL mutation execution via useMutation hook
5. Field-level error display
6. Loading state management
7. Redirect on success

**Form Fields:**
- Project Name (required, text input)
- Description (optional, textarea)
- Priority (required, select dropdown)
- Status (required, select dropdown)
- Visibility (required, select dropdown)
- Tags (dynamic input with Enter key)

**Error Handling:**
- Per-field validation errors
- Form-level error messages
- Field-level visual feedback (red borders)

### Validation Schema
**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/schemas/projectForm.ts`

```typescript
// Enums
ProjectStatus: ACTIVE, CANCELLED, COMPLETED, ON_HOLD
ProjectPriority: LOW, MEDIUM, HIGH, URGENT
ProjectVisibility: PUBLIC, PRIVATE, TEAM

// Schema Rules
name: min 3, max 100 characters
description: optional, max 500 characters
priority: required, enum
status: required, enum
visibility: required, enum
tags: max 10, each tag max 30 characters
```

### Task Create Form Reference (for pattern comparison)
**File:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/tasks/NewTaskForm.tsx` (27.5 KB)

Shows pattern for more complex forms with:
- Rich text editor
- Multiple select fields
- Date pickers
- Assignee selection
- Progress type tracking
- Subtask management

---

## 6. Existing Project Fields in GraphQL

### From GET_PROJECTS Query
```
projectId, name, description, owner, createdBy, priority, 
visibility, tags, progress, category, metadata, startDate, 
endDate, iconUrl, isPublic, status, memberCount
```

### From CREATE_PROJECT Response
```
projectId, name, description, startDate, endDate, status, 
priority, visibility, tags, category, metadata, iconUrl, 
isPublic, createdAt, owner (with userId, email, username, fullName, avatarUrl)
```

### Fields NOT in Current Mutations
- progress
- category (missing from some queries)
- metadata
- tags (handled via array in schema)
- createdBy
- isPublic (vs public)

---

## 7. UI Components Library

**Location:** `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/ui/`

Available UI Components:
- Button.tsx - Styled button component
- Card.tsx - Card container
- Dialog.tsx - Modal dialog (Headless UI based)
- ConfirmationModal.tsx - Confirmation dialogs
- Accordion.tsx - Accordion component
- DatePicker.tsx - Date selection
- InputField.tsx - Form input with validation styling
- SelectField.tsx - Dropdown select
- FormField.tsx - Form field wrapper
- Spinner.tsx - Loading spinner
- Tabs.tsx - Tab navigation
- ValidationStatus.tsx - Validation feedback
- Tooltip.tsx - Tooltip component

---

## 8. API Endpoints

### Project Endpoints
- `POST /api/projects` - Create project
- `PUT /api/projects/{id}` - Update project
- `GET /api/projects` - List projects (via GraphQL preferred)
- `GET /api/projects/{id}` - Get project details (via GraphQL preferred)

---

## 9. Key Implementation Details

### Project List Display
- Uses Apollo Client `useQuery` hook
- Grid layout with 3 columns on large screens
- Shows 5-8 project cards per view
- Lazy loading state with spinner
- Error state with retry button
- Empty state with "Create Project" CTA

### Project Form Features
- Accordion-based organization for long forms
- Icon indicators for each section
- Real-time field validation
- Error messages below each field
- Cancel/Submit buttons at bottom
- Loading state on submit button

### Modal Pattern Best Practices
- Backdrop click prevention available
- Title prop required
- Children-based content (flexible)
- Smooth animations via Transition
- Body scroll prevention

---

## 10. Key File Paths Summary

| Purpose | Path |
|---------|------|
| Project Types | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/types/project.ts` |
| GraphQL Queries/Mutations | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/graphql/queries/project.ts` |
| Project List Component | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/projects/ProjectList.tsx` |
| Create Form Component | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/projects/ProjectForm.tsx` |
| Create Page | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/new/page.tsx` |
| Projects Page | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/app/projects/page.tsx` |
| Validation Schema | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/schemas/projectForm.ts` |
| Modal Base Component | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/ui/Dialog.tsx` |
| Confirmation Modal | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/ui/ConfirmationModal.tsx` |
| Complex Modal Example | `/Users/TienVNV/Desktop/ProjectManager/frontend/src/components/tasks/TaskFilterModal.tsx` |

---

## Summary

**Existing Project Creation Flow:**
1. User navigates to `/projects/new` (page.tsx)
2. Form renders with Zod validation schema
3. User fills fields (name required, others optional)
4. Form calls CREATE_PROJECT mutation (already defined)
5. Redirect to `/projects/{id}` on success

**Modal Pattern:** Headless UI Dialog with optional backdrop-click prevention and smooth animations

**Form Pattern:** Client-side Zod validation + GraphQL mutation + per-field error display

**Main Components Ready to Use:**
- ProjectList component for displaying projects
- ProjectForm component for forms
- Dialog component for modals
- ConfirmationModal for confirmations
