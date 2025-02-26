# Master Page Layouts

## 1. Main Master Page (ProjectMaster)
**Used for core project management screens**

### Layout Components
- Header:
  - Logo (left)
  - Global search (center)
  - Notifications bell (right)
  - User profile dropdown (right)
- Left Navigation Bar:
  - Dashboard link
  - Projects list
  - Reports
  - Calendar
  - Settings
- Configurable Right Sidebar
- Main Content Area

### Applied to Screens
- Dashboard
- Project List
- Project Details (Kanban View)
- Task List View
- Team Members
- Reports & Analytics

### Characteristics
- Full navigation capability
- Quick access to all project features
- Collapsible sidebars
- Responsive layout

---

## 2. Task Master Page (TaskMaster)
**Used for detailed task views and editing**

### Layout Components
- Simplified Header:
  - Back button (left)
  - Task title (center)
  - Action buttons (right)
- Right Sidebar:
  - Task details
  - Activity log
  - Comments section
- Main Content Area

### Applied to Screens
- Task Details
- Task Edit
- Subtask Management
- Comments & Discussion

### Characteristics
- Focus on task content
- Quick navigation back to project
- Maximum space for content
- Persistent task details sidebar

---

## 3. Authentication Master Page (AuthMaster)
**Used for authentication-related screens**

### Layout Components
- Minimal Header:
  - Logo (center)
- Full-screen content area
- Footer with links

### Applied to Screens
- Login
- Registration
- Password Reset
- Email Verification

### Characteristics
- Clean, distraction-free layout
- Centered content
- No navigation elements
- Brand-focused design

---

## 4. Analytics Master Page (AnalyticsMaster)
**Used for data-intensive views**

### Layout Components
- Header:
  - Title and breadcrumbs
  - Time period selector
  - Export actions
- Collapsible Left Sidebar:
  - Filters
  - Data grouping options
- Full-width content area

### Applied to Screens
- Gantt Chart
- Timeline View
- Advanced Reports
- Resource Management

### Characteristics
- Maximum screen space utilization
- Flexible layout for large datasets
- Optimized for horizontal scrolling
- Quick access to view options

---

## Implementation Notes

### Shared Components
- Theme provider
- Error boundaries
- Loading states
- Toast notifications

### Responsive Behavior
- All master pages should adapt to:
  - Desktop (1200px+)
  - Tablet (768px - 1199px)
  - Mobile (< 768px)

### State Management
- Global state for:
  - User session
  - Theme preferences
  - Notifications
  - Sidebar states

### Navigation Control
- Each master page manages its own navigation rules
- Consistent back/forward behavior
- Breadcrumb implementation where applicable

### Accessibility
- ARIA landmarks for each layout section
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
