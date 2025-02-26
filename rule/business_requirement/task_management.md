# Task Management Business Requirements

## Core Task Features

### 1. Task Creation and Editing
- [x] Rich text task descriptions
  - Support for formatting, images, and tables
  - Custom toolbar with common options
  - Preview mode for content
- [x] Task form in new tab
  - Auto-save draft functionality
  - Form validation
  - File attachments support

### 2. Task Organization and Priority
- [x] Priority Management
  - Automatic priority numbering system
  - Drag & drop reordering
  - Visual priority indicators
  - Priority-based task scheduling
- [x] Status Management
  - Automatic date updates on status changes
  - Start date set when moving to "IN_PROGRESS"
  - Completion date set when moving to "DONE"
- [x] Completed Tasks Management
  - Separate view for completed tasks
  - Different sorting rules for completed items
  - Toggle to show/hide completed tasks

### 3. Task Views and Navigation
- [x] List View
  - Priority-based ordering
  - Drag & drop reordering
  - Advanced filtering options
  - Bulk actions support
- [x] Kanban Board
  - Status-based columns
  - Drag & drop between statuses
  - Quick edit functionality
- [x] Timeline View
  - Priority-based scheduling
  - Automatic date calculations
  - Resource allocation view
  - Interactive tooltips

## Business Rules

### Priority Management
1. [x] Priority Order Rules
   - Each task has a unique priority order within its project
   - Only incomplete tasks participate in priority ordering
   - New tasks are added at the end of priority queue
   - Reordering updates all affected task priorities

2. [x] Status Transitions
   - Moving to "IN_PROGRESS" sets start date if not set
   - Moving to "DONE" sets completion date
   - Status changes may affect task scheduling

3. [x] Task Scheduling
   - Tasks without dates are scheduled based on priority
   - Higher priority tasks are scheduled earlier
   - Task effort affects duration calculation
   - Dependencies are considered in scheduling

### User Interface Rules
1. [x] Task Organization
   - Incomplete tasks are sorted by priority order
   - Completed tasks are sorted by completion date
   - Drag & drop disabled for completed tasks
   - Visual separation between complete/incomplete tasks

2. [x] Filtering and Sorting
   - Multiple filter criteria support
   - Status-based filtering
   - Priority-based sorting
   - Date range filtering
   - Assignee filtering

3. [x] Bulk Operations
   - Multiple task selection
   - Bulk status updates
   - Bulk priority changes
   - Bulk deletion
   - Export selected tasks

## Data Management

### Required Task Fields
- [x] Title (required)
- [x] Description (rich text)
- [x] Status
- [x] Priority
- [x] Priority Order
- [x] Start Date (optional, auto-set)
- [x] Deadline (optional)
- [x] Effort Hours
- [x] Assignees
- [x] Project Reference
- [x] Created By
- [x] Created/Updated Timestamps

### Data Validation Rules
1. Priority Order
   - Must be unique within project
   - Must be positive integer
   - Automatically maintained on reorder

2. Dates
   - Start date ≤ Deadline
   - Auto-update based on status
   - Optional but recommended

3. Status Transitions
   - Valid status progression
   - Date updates on transitions
   - Maintain task history

## Performance Requirements
- Optimistic updates for reordering
- Efficient priority recalculation
- Smooth drag & drop experience
- Quick filtering and sorting
- Responsive bulk operations
