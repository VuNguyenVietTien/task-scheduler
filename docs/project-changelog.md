# Project Changelog

All notable changes to the ProjectManager system are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

#### Gantt Chart Filter Bar (2026-03-30)
- Created `GanttFilter` interface in `web/src/types/task.ts` for filter state management
- Implemented `gantt-filter-bar.tsx` component with compact filter UI supporting:
  - Search by task name
  - Status filtering (all task statuses)
  - Priority filtering (all priority levels)
  - Type filtering (Bug, Feature, Enhancement, Documentation)
  - Tag filtering (multi-select)
- Integrated `GanttFilterBar` into Timeline component Gantt toolbar
- Updated Timeline component to compute `visibleTasks` from `filteredTasks` with Gantt-specific filter applied
- Modified `handleSavePlan` to save only currently visible (filtered) tasks to prevent unintended data loss
- Preserves existing filter context when switching between view modes

#### Vercel + Supabase Migration (2026-03-27)
- Created `web/` directory: unified Next.js app replacing 2 Rust microservices (task-scheduler-backend + design-doc-service)
- Supabase client library with server-side (service role), browser (anon key), and middleware (session refresh) implementations
- GraphQL Yoga server at `/api/graphql` with unified schema merging both backends (task-scheduler + design-doc domains)
- 20+ service files implementing Supabase JS queries for all domains (projects, tasks, users, designs, screens, components, etc.)
- 14 GraphQL resolver files with real service implementations (queries, mutations, nested resolvers)
- Supabase Realtime integration replacing custom WebSocket notification system
- Consolidated dual Apollo clients into single `/api/graphql` endpoint for unified GraphQL access
- Firebase-to-Supabase Auth bridge with create-on-first-login user migration strategy
- REST API endpoints: comments, attachments, media upload via Supabase Storage
- Vercel deployment configuration with function timeout settings (10s Hobby / 60s Pro)
- Build verification: `npm run build` passes successfully with no compilation errors
- Tested GraphQL queries/mutations against Supabase backend with real data operations
- Migration note: `web/` is new codebase; `frontend/` + Rust backends remain production system until full validation complete

#### Documents Tab in Project Detail View (2026-03-26)
- **Documents Tab**: New "Tai lieu" (Documents) tab in project detail sidebar navigation
- **Design System List**: Tab integrates existing design system list UI, shows all design systems for current project
- **Create Design System**: Users can create new design systems directly from Documents tab
- **Isolated Apollo Client**: Separate Apollo client for design-doc-service (port 8081) prevents cache conflicts with main backend
  - Frontend maintains two Apollo clients: one for task-scheduler-backend (8080), one for design-doc-service (8081)
  - DocumentsTab component wraps design system UI and manages its own ApolloProvider
  - Prevents GraphQL cache pollution between services

#### Task Detail Editable Fields + Task Edit Modal (2026-03-25)
- **Editable Actual Dates**: Made `actual_start_date` and `actual_end_date` editable as inline date fields in TaskDetail modal
- **Full Page Support**: Added editable actual date fields to full-page TaskDetailPage component
- **KanbanBoard Integration**: Integrated TaskDetail modal into KanbanBoard task cards with left-click to open
- **Gantt/Timeline Integration**: Wired up task click handlers in Timeline component to open TaskDetail modal
- **Unified Click Behavior**: Standardized left-click (open modal) vs Ctrl+click/middle-click (navigate to full page) across List, Kanban, and Gantt views
- **Modal Edit Sync**: Task updates in modal reflect immediately in all views (List, Kanban, Gantt, Timeline)

#### Report System Refactor (2025-03-25)
- **Role System Update**: Member roles extended from Admin/Member/Viewer to Manager/Leader/Member/Guest
  - Manager: full control (replaces Admin)
  - Leader: manage tasks and team members (new role)
  - Member: work on assigned tasks (unchanged)
  - Guest: view-only access (replaces Viewer)
- **Reports Component Modularization**: ReportView.tsx split into modular components
  - `daily-report-view`, `period-report-view`, `report-metrics-card`
  - `date-range-picker` for flexible report date selection
  - `plan-selector-dropdown` for plan-vs-actual comparison analysis
- **Daily Report Fixes**:
  - Date filtering logic corrections
  - Proper handling of unassigned members
  - Accurate startedToday metrics calculation
- **Extended Report Types**: Weekly, monthly, quarterly reports with date range picker
- **Frontend Metrics Calculation**: Reports now calculate metrics from Redux tasks (no backend resolvers required)
- **Database Schema Updates**:
  - New columns: rejected_tasks, on_schedule_percentage, delay_percentage
  - Unique constraint: (report_type, period_start_date, period_end_date, project_id)
  - Member role enum extended with new role values
- **Redux Reports Reducer**: New reducer added to store for reports state management

#### UI Refactor v2.29 (2025-03-25)
- **Sidebar Navigation Redesign**: Dark sidebar (w-60, bg-slate-900) with Dashboard link and expandable project tree
  - URL-driven navigation with `/projects/{id}?tab={tabId}` routing
  - LocalStorage persistence for expanded/collapsed project states
- **Project Detail View Compression**: Removed header and tab bar from ProjectDetailView; tab switching now handled via sidebar
- **Role-Based Dashboard**: Real GraphQL data integration with role-specific views
  - Project Managers see overdue tasks, bugs, and critical issues
  - Team members see assigned tasks
- **Gantt Chart Responsive Improvements**: Fixed plan toolbar with `whitespace-nowrap` and `overflow-x-auto` for better mobile handling
- **Task List Type Column**: New "Loai" (Type) column with color-coded badges
  - Bug (red), Feature (blue), Enhancement (purple), Documentation (green)

#### Design Document Service (v1.0.0)
- New microservice: `design-doc-service` (Rust, Actix-web, async-graphql, SQLx)
  - Async GraphQL API for design document operations
  - Clipboard SVG import from Figma and Google Stitch with automatic component extraction
  - Database schema with 12 tables supporting design management:
    - `systems` and `modules`: Hierarchical organization
    - `design_documents`: Primary document storage
    - `screens`: UI screen definitions with SVG
    - `components`: Reusable components with properties
    - `field_mappings`: Component field to database column mappings
    - `flows` and `flow_steps`: Business process flows with Mermaid diagram support
    - `tags` and `entity_tags`: Flexible tagging system
    - `external_links`: External resource tracking (Figma, wireframes, etc.)
    - `document_audit`: Change history and audit trail with JSONB payloads
  - JWT-based authentication with task-scheduler-backend (shared secret)
  - HTTP API for inter-service communication on port 8081
  - GIN index support for full-text search on JSONB fields
  - Batch operation support for bulk imports
  - Query caching for performance optimization

#### Frontend Design Pages & Components
- 4 new page routes under `/designs/`:
  - `/designs`: Design document library with search and filtering
  - `/designs/[id]`: Detail view with split-pane editor
  - `/designs/new`: Create new design with clipboard paste from Figma/Google Stitch
  - `/designs/[id]/impact`: Impact analysis dashboard

- 10+ new React components:
  - `design-viewer-split-pane`: Split-view editor (design and code side-by-side)
  - `paste-design-zone`: Drag-and-drop and clipboard paste handler for SVG imports
  - `design-frame-interactive-svg`: Interactive SVG renderer with hotspot support
  - `component-mapping-editor`: UI for field mapping configuration
  - `flow-diagram-renderer`: Mermaid diagram visualization
  - `tag-manager`: Tag creation and assignment interface
  - `audit-trail-viewer`: Change history viewer with filters
  - `impact-analysis-visualizer`: Visual representation of change impacts
  - `field-mapping-editor`: Advanced mapping configuration
  - `external-link-manager`: Link management and validation

#### Design Features
- **SVG Import**: Parse and store Figma/Google Stitch clipboard exports
- **Component Database Mapping**: Link UI components to database field definitions
- **Impact Analysis**: Identify affected tasks and database changes
- **Business Flows**: Create and visualize process flows with Mermaid syntax
- **i18n Support**: Multilingual description fields for documents and components
- **External Link Tracking**: Maintain references to Figma files, wireframes, specifications
- **AI-Ready Export**: Export design data in JSON/YAML formats for ML processing
- **Audit Trail**: Complete change history with user attribution and timestamps

#### Database Enhancements
- Design document schema in PostgreSQL (shared cluster)
- Migration scripts for incremental schema deployment
- Performance indexes on frequently queried columns
- JSONB support for flexible metadata storage

### Changed
- Frontend now integrates design management alongside task scheduling
- PostgreSQL cluster configured for multi-service access

### Fixed
- (No breaking changes in this release)

## [Previous Releases]

### [v2.29] - 2025-03-23
- Gantt chart improvements and task creation bug fixes
- FCM notification duplicate initialization resolved
- Report logic corrections
- Comment deletion improvements
- Notification link redirect enhancements

### [v2.28] - Prior
- Core task scheduling functionality
- Project management features
- Team collaboration tools
- Real-time notifications via FCM
- Gantt chart visualization
- WebSocket-based real-time updates

---

## How to Update Changelog

1. **When releasing**: Move [Unreleased] items to a new version section with date
2. **Format**: `### [COMPONENT_NAME]` for grouped changes
3. **Severity**: Note breaking changes with `⚠️ BREAKING` prefix
4. **References**: Link to relevant issues/PRs when applicable
5. **Type markers**: Use Added/Changed/Fixed/Removed/Deprecated/Security prefixes

## Version Numbering

- **Major.Minor.Patch** (e.g., 2.29.0)
- **Major**: Significant architectural changes
- **Minor**: New features and enhancements
- **Patch**: Bug fixes and minor improvements
