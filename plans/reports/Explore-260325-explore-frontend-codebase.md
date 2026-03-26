# Frontend Codebase Exploration Report

**Date:** March 25, 2026  
**Project:** task-scheduler-frontend  
**Scope:** Comprehensive codebase structure analysis

---

## Summary

The task-scheduler-frontend is a Next.js 13+ app-router based project with a modern tech stack (TypeScript, React, Apollo GraphQL, Redux, Tailwind CSS). Key findings show multiple sidebar components, a flexible layout system with tabs for project details, and well-structured auth context & types.

---

## 1. SIDEBAR COMPONENT

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/ui/navigation/Sidebar.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';

const Sidebar = () => {
  const menuItems = [
    { href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard' },
    { href: '/projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Projects' },
    { href: '/reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Reports' },
    { href: '/calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Calendar' },
    { href: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', label: 'Settings' },
  ];

  return (
    <aside className="fixed top-16 left-0 h-full w-64 bg-white shadow-md">
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center p-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
```

**Note:** There are multiple sidebar components. Also found `/src/components/layout/Sidebar.tsx` (simpler version with 4 nav items) and `/src/components/common/Sidebar.tsx`.

---

## 2. LAYOUT STRUCTURE

**Main App Layout:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/layout.tsx`

```tsx
'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { ClientProviders } from "@/providers/ClientProviders";
import { Toaster } from "sonner";
import Layout from "@/components/ui/navigation/Layout";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          {isAuthRoute ? (
            children
          ) : (
            <Layout>
              {children}
            </Layout>
          )}
          <Toaster richColors position="top-right" />
        </ClientProviders>
      </body>
    </html>
  );
}
```

**Main Layout Component:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/ui/navigation/Layout.tsx`

```tsx
import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import FcmNotificationHandler from '@/components/common/FcmNotificationHandler';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      {user && <FcmNotificationHandler userId={user.id} />}
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
```

**Layout Pattern:**
- Header (fixed top-0) height: 16 (64px)
- Sidebar (fixed top-16) width: 64 (256px)
- Main content: pl-64 pt-16 (padding-left 256px, padding-top 64px)

---

## 3. PROJECT DETAIL PAGE WITH TABS

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/page.tsx`

Entry point that wraps with ProtectedRoute, Suspense, and dynamic loading:

```tsx
export default function ProjectDetail({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingFallback />}>
        <ProjectPageWrapper id={params.id} />
      </Suspense>
    </ProtectedRoute>
  );
}
```

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/projects/ProjectDetailView.tsx` (432 lines)

**Tabs Implementation:**

```tsx
const tabs = [
  {
    id: 'list',
    label: 'Danh sách công việc', // Task List
    icon: <svg>...</svg>
  },
  {
    id: 'kanban',
    label: 'Kanban',
    icon: <svg>...</svg>
  },
  {
    id: 'gantt',
    label: 'Biểu đồ Gantt', // Gantt Chart
    icon: <svg>...</svg>
  },
  {
    id: 'members',
    label: 'Thành viên', // Members
    icon: <svg>...</svg>
  },
  {
    id: 'report',
    label: 'Báo cáo', // Report
    icon: <svg>...</svg>
  }
];
```

**Tab Rendering:**
- activeView state tracks current tab (default: 'list')
- Tab content rendered based on activeView
- Each view component receives project and task data from Redux store

**Key Data Flow:**
- Uses Redux for state: `useAppSelector(state => state.tasks)`, `state.members`, `state.plans`
- Fetches data with: `fetchProjectTasks()`, `fetchProjectMembers()`, `fetchProjectPlans()`
- Task transformation from different API formats to unified schema
- Pagination and filtering support

---

## 4. DASHBOARD PAGE

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/dashboard/page.tsx`

```tsx
'use client';

import { useTasks } from '@/hooks/useTasks';
import { PriorityTaskList } from '@/components/timeline/PriorityTaskList';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const router = useRouter();

  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.name}!</h1>
        <p className="text-gray-600">Here's an overview of your tasks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tasks Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Priority Tasks</h2>
            <div className="h-[400px]">
              <PriorityTaskList tasks={tasks || []} title="Priority Tasks" />
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            {isLoading ? (
              // Loading skeleton
            ) : (
              <div className="space-y-4">
                {tasks?.slice(0, 5).map(task => (
                  <div key={task.task_id} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full
                        ${task.status === 'done' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                        }`}>
                        {task.status?.replace('_', ' ') || 'pending'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{task.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Dashboard Layout:**
- 2-column grid for desktop (lg:grid-cols-2)
- Priority Tasks section (left)
- Recent Activity section (right)
- Uses `useTasks()` hook to fetch all user tasks
- Status badges with color coding

---

## 5. ROUTER/NAVIGATION SETUP

**Router Type:** Next.js 13+ App Router (not Pages Router)

**Routing Structure:**
- `/` → Dashboard
- `/projects` → Projects List
- `/projects/[id]` → Project Detail with tabs
- `/projects/[id]/tasks/[taskId]` → Task Detail
- `/projects/[id]/add-task` → Add Task
- `/calendar` → Calendar
- `/reports` → Reports
- `/settings` → Settings
- `/auth` → Authentication

**Navigation Implementation:**
- Client-side routing with `next/navigation` (useRouter, usePathname)
- Active route detection with pathname matching
- Protected routes with ProtectedRoute component
- Dynamic imports with Suspense for code splitting

---

## 6. GRAPHQL QUERIES FOR USER PROJECTS

**Primary Query File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/graphql/queries/projects.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      projectId
      name 
      description
      owner
      createdBy
      priority
      visibility
      tags
      progress
      category
      metadata
      startDate
      endDate
      iconUrl
      isPublic
      status
      memberCount
      owner {
        userId
        email
        name
        avatarUrl
      }
    }
  }
`;

export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($projectId: UUID!) {
    project(project_id: $projectId) {
      projectId
      name
      description 
      owner
      createdBy
      priority
      visibility
      tags
      progress
      category
      metadata
      startDate
      endDate
      iconUrl
      isPublic
      status
      memberCount
      owner {
        userId
        email
        name
        avatarUrl
      }
      members {
        userId
        email
        name
        avatarUrl
        role
        joinedAt
      }
    }
  }
`;
```

**Alternative Query File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/graphql/queries/project.ts`

Defines `GET_USER_PROJECTS` with fields: projectId, name, startDate, endDate, status, memberCount, progress, category, priority, visibility, iconUrl, owner info.

**Available GraphQL Queries:**
- `GET_PROJECTS` - All projects
- `GET_PROJECT_BY_ID` - Single project with members
- `GET_USER_PROJECTS` - User's projects specifically

---

## 7. AUTH CONTEXT

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/contexts/AuthContext.tsx` (234 lines)

**User Interface:**

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
  providerData: ProviderData[];
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  sendVerificationEmail: () => Promise<void>;
}
```

**Key Features:**
- Firebase authentication integration
- Backend sync via `/api/auth/firebase/login`
- Auth check on app load via `/api/auth/me`
- Google OAuth support
- Email/password login & register
- Loading state during auth checks
- Automatic redirects (auth → dashboard, user → auth)

**Usage Hook:**

```typescript
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Accessing Current User:**
```tsx
const { user, loading } = useAuth();
// user.id, user.email, user.name, user.role available
```

---

## 8. TASK LIST COMPONENT WITH TYPE/CATEGORY

**File:** `/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/tasks/TaskListView.tsx` (1500+ lines)

**Task Type Definitions** (`/src/types/task.ts`):

```typescript
export type TaskStatus = 'todo' | 'doing' | 'done' | 'close' | 'pending' | 'review' | 'blocked' | 'rejected' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';
export type ProgressType = 'study' | 'investigate' | 'code' | 'test' | 'review_code' | 'review_test_report' | 'release';
export type TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation';
export type TaskCategory = 'Frontend' | 'Backend' | 'Design' | 'Testing' | 'DevOps';

export const TASK_TYPES: TaskType[] = ['Feature', 'Bug', 'Enhancement', 'Documentation'];
export const TASK_CATEGORIES: TaskCategory[] = ['Frontend', 'Backend', 'Design', 'Testing', 'DevOps'];
```

**Task Interface:**

```typescript
export interface Task {
  task_id: string;
  id?: string;
  project_id: string;
  projectId?: string;
  parent_task_id?: string;
  
  title: string;
  description?: string;
  assignee?: UserBasic;
  priority_order: number;
  
  status: TaskStatus;
  priority: Priority;
  type?: TaskType;           // Feature, Bug, Enhancement, Documentation
  category?: TaskCategory;   // Frontend, Backend, Design, Testing, DevOps
  progress_type?: ProgressType;
  
  start_date?: string;
  due_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  created_at?: string;
  updated_at?: string;
  
  effort?: number;
  progress?: number;
  created_by: string | UserBasic;
  tags?: TaskTag[];
  child_tasks?: Task[];
}
```

**Table Columns Rendered:**

```tsx
<thead className="bg-slate-50">
  <tr>
    <th>Checkbox</th>
    <th>Tiêu đề (Title)</th>
    <th>Trạng thái (Status)</th>
    <th>Ưu tiên (Priority)</th>
    <th>Người được giao (Assignee)</th>
    <th>Hạn (Due Date)</th>
    <th>Công sức (Effort)</th>
    <th>Actions</th>
  </tr>
</thead>
```

**Note:** Type and Category columns NOT currently displayed in task list view. They exist in Task interface but rendering logic focuses on: title, status, priority, assignee, due date, effort.

**Key Features:**
- Nested task support (parent/child relationships)
- Multi-select with bulk actions
- Inline editing for status, priority, assignee, due date, effort
- Row expansion for subtasks
- Status summary counts
- Completed tasks toggle visibility

---

## 9. ADDITIONAL INSIGHTS

**Tech Stack:**
- Next.js 13+ (App Router)
- TypeScript
- React 18
- TailwindCSS
- Apollo Client (GraphQL)
- Redux Toolkit (state management)
- Firebase (authentication)

**Provider Setup:**
- File: `/src/providers/ClientProviders.tsx`
- Wraps app with: AuthProvider, Redux, Apollo Client, React Query

**Header Component:**
- Search button (non-functional stub)
- Notifications dropdown with unread count
- Account dropdown (settings, logout)
- User name/email display

**Key Directories:**
- `/src/app/` - Next.js app router pages
- `/src/components/` - React components
- `/src/graphql/` - GraphQL queries & mutations
- `/src/hooks/` - Custom React hooks
- `/src/contexts/` - React contexts (Auth)
- `/src/redux/` - Redux slices & store
- `/src/types/` - TypeScript interfaces
- `/src/lib/` - Utility libraries

---

## Key Questions/Observations

1. **Multiple Sidebar Components:** Three sidebar components exist (`/layout/Sidebar.tsx`, `/common/Sidebar.tsx`, `/ui/navigation/Sidebar.tsx`). The one in `/ui/navigation/` is used in main Layout. Consider consolidating if not intentional.

2. **Type/Category Not Displayed:** Task type and category exist in Task schema but aren't displayed in TaskListView table. Should they be added as columns?

3. **Dashboard Layout:** Uses separate DashboardLayout in `/app/dashboard/layout.tsx` instead of main Layout. Has custom header/auth checks.

4. **Redux vs Apollo:** Project uses both Redux (for tasks, members, plans) AND Apollo GraphQL. Unclear if both are necessary or if one should be primary.

5. **No Settings/Calendar Pages:** Sidebar links to /settings and /calendar but no implementation found in /app directory.

---

## Files Summary

| Component | File Path | Lines | Type |
|-----------|-----------|-------|------|
| Sidebar | `/src/components/ui/navigation/Sidebar.tsx` | 44 | TSX |
| Header | `/src/components/ui/navigation/Header.tsx` | 143 | TSX |
| Layout | `/src/components/ui/navigation/Layout.tsx` | 28 | TSX |
| RootLayout | `/src/app/layout.tsx` | 36 | TSX |
| ProjectDetail | `/src/app/projects/[id]/page.tsx` | 52 | TSX |
| ProjectDetailView | `/src/components/projects/ProjectDetailView.tsx` | 432 | TSX |
| Dashboard | `/src/app/dashboard/page.tsx` | 76 | TSX |
| TaskListView | `/src/components/tasks/TaskListView.tsx` | 1500+ | TSX |
| AuthContext | `/src/contexts/AuthContext.tsx` | 234 | TSX |
| Task Types | `/src/types/task.ts` | 146 | TS |
| Project Types | `/src/types/project.ts` | 99 | TS |
| GraphQL Projects | `/src/graphql/queries/projects.ts` | 69 | TS |

