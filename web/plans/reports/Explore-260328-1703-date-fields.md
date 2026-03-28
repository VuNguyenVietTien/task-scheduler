# Date Field Exploration Report
**Date**: 2026-03-28  
**Project**: ProjectManager Web  
**Scope**: Task & Project date field management

---

## Summary
Found **8 primary locations** where users can create/edit date fields (start_date, due_date, end_date, actual_start_date, actual_end_date) for both tasks and projects. Dates can be cleared to null.

---

## TASKS - Date Field Locations

### 1. TaskForm.tsx (Basic Task Creation)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskForm.tsx`
**Function**: `TaskForm` (React component)
**Fields**: 
- `startDate` (line 56-57)
- `deadline` (line 57)

**Date Handling**:
- Input type: `type="date"` (lines 197, 217)
- On save: Date values split on 'T' character: `task.startDate?.split('T')[0]`
- GraphQL: Uses `UPDATE_TASK` mutation from `/graphql/mutations/tasks.ts`
- Clearing: Fields are optional, can be empty

---

### 2. TaskDetail.tsx (Modal for Inline Editing)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskDetail.tsx`
**Function**: `TaskDetail` (Dialog component)
**Fields**:
- `start_date` (line 433)
- `due_date` (line 434)
- `actual_start_date` (line 435)
- `actual_end_date` (line 436)

**Date Handling**:
- Input type: `type="date"` (line 245)
- On save: Converts to ISO string with "T00:00:00Z" suffix if not already ISO format (lines 119-124)
- GraphQL: Uses `UPDATE_TASK` mutation via `updateTask()` hook
- Clearing: **YES - can be set to null** (lines 119-124 check if value exists before converting)
- Edit flow:
  1. Click to edit (displays current date or "Chua thiet lap")
  2. Input date picker opens
  3. Save with checkmark button (calls `saveField()`)
  4. Cancel with X button (reverts changes)

**Code snippet** (saveField logic):
```typescript
case 'start_date': updates.start_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : undefined; break;
case 'due_date': updates.due_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : undefined; break;
case 'actual_start_date': updates.actual_start_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : undefined; break;
case 'actual_end_date': updates.actual_end_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : undefined; break;
```

---

### 3. NewTaskForm.tsx (Task Creation Form)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/NewTaskForm.tsx`
**Function**: `NewTaskForm` (React Hook Form component)
**Fields**:
- `startDate` (FormInputs interface)
- `dueDate` (lines 571-587)

**Date Handling**:
- Input type: `type="datetime-local"` (line 578) - **NOTE: This is datetime, not date**
- On save: Converts to ISO string (lines 321-322):
  ```typescript
  start_date: data.startDate ? new Date().toISOString() : null,
  due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
  ```
- GraphQL: Uses `CREATE_TASK` mutation from `/graphql/mutations.ts`
- Clearing: **YES - can be null** (ternary check for null if no value)

---

### 4. TaskDetailPage.tsx (Comprehensive Task Editor)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/TaskDetailPage.tsx`
**Function**: `TaskDetailPage` (Complex component with tabs)
**Fields**: Supports same date fields as TaskDetail.tsx
- `start_date`
- `due_date`
- `actual_start_date`
- `actual_end_date`

**Date Handling**:
- Uses `renderEditableField()` helper function (passed to child DetailsTab)
- Inline editing with confirm/cancel
- GraphQL: `UPDATE_TASK` mutation
- Clearing: **YES - optional fields**

---

### 5. TaskDetailsPanel.tsx (Details Side Panel)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/details/TaskDetailsPanel.tsx`
**Function**: `TaskDetailsPanel` (Component)
**Fields**:
- `start_date` (line 141)
- `due_date` (line 144)

**Date Handling**:
- Similar to TaskDetail.tsx with inline editing
- On save: Converts to ISO format
- GraphQL: `UPDATE_TASK` mutation
- Clearing: **YES**

---

### 6. DetailsTab.tsx (Task Details Tab)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/tabs/DetailsTab.tsx`
**Function**: `DetailsTab` (Display component)
**Fields**:
- `start_date` (line 61, rendered editable)
- `due_date` (line 62, rendered editable)
- `actual_start_date` (line 68, read-only display)
- `actual_end_date` (line 75, read-only display)

**Date Handling**:
- Editable fields use `renderEditableField()` helper
- Read-only display using `formatDate()` helper
- On save: Via parent's `renderEditableField` implementation
- Clearing: **YES for start_date and due_date**
- Note: actual_start_date and actual_end_date are **read-only in this component** (lines 68, 75)

---

### 7. InlineEditableField.tsx (Reusable Component)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/inline-editable-field.tsx`
**Function**: `InlineEditableField` (Generic component)
**Supports**: `type="date"` (line 11, 167)

**Date Handling**:
- Generic input field component for inline editing
- Accepts `type="date"` parameter
- Calls `onSave()` callback with new value
- Clearing: **YES - allows empty input** (draft can be empty string)

---

### 8. useTasks.ts (Task Update Hook)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/hooks/useTasks.ts`
**Function**: `updateTaskApi()` (API handler)
**Fields**: 
- `start_date` (line 128-130)
- `due_date` (line 132-134)
- `actual_start_date` (line 136-138)
- `actual_end_date` (line 140-142)

**Date Handling**:
- Converts date strings to ISO format via `new Date().toISOString()`
- **Critical**: Sets to **null if empty** (ternary check)
- GraphQL: Uses `UPDATE_TASK` mutation
- Clearing: **YES - explicitly converts empty values to null**

**Code**:
```typescript
if (updates.start_date !== undefined) {
  input.start_date = updates.start_date ? new Date(updates.start_date).toISOString() : null;
}
if (updates.due_date !== undefined) {
  input.due_date = updates.due_date ? new Date(updates.due_date).toISOString() : null;
}
if (updates.actual_start_date !== undefined) {
  input.actual_start_date = updates.actual_start_date ? new Date(updates.actual_start_date).toISOString() : null;
}
if (updates.actual_end_date !== undefined) {
  input.actual_end_date = updates.actual_end_date ? new Date(updates.actual_end_date).toISOString() : null;
}
```

---

## PROJECTS - Date Field Locations

### 1. ProjectForm.tsx (Project Creation/Edit)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/ProjectForm.tsx`
**Function**: `ProjectForm` (React component)
**Fields**:
- `start_date` (line 23, 46-47)
- `due_date` (line 24, 47)

**Date Handling**:
- Uses custom `DatePicker` component (lines 151-165)
- DatePicker component: `/components/ui/date-picker.tsx`
- Input: React Date objects (not strings)
- On save: Serialized as JSON in form submission (line 77)
- REST API: POST/PUT to `/api/projects` endpoint
- Clearing: **YES - DatePicker accepts null** (line 162-163):
  ```typescript
  <DatePicker
    date={formData.due_date}
    onChange={(date: Date | null) => handleInputChange('due_date', date)}
  />
  ```

---

### 2. DatePicker.tsx (Reusable Date Component)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/ui/date-picker.tsx`
**Function**: `DatePicker` (UI component)

**Date Handling**:
- Uses `react-day-picker` library (DayPicker)
- Input: `date?: Date | null` (line 10)
- Callback: `onChange: (date: Date | null) => void` (line 11)
- Clearing: **YES - explicitly accepts null** (line 42, 44)
- Display: Uses `date-fns` format library (line 24): `format(date, 'PPP')`

---

### 3. CreateProjectModal.tsx (Modal for Quick Create)
**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/components/projects/create-project-modal.tsx`
**Function**: `CreateProjectModal` (Dialog component)
**Fields**: 
- Note: **Does NOT have date fields** (focuses on name, description, priority, status, visibility, tags)

---

## GraphQL MUTATIONS

### For Tasks:

**File**: `/Users/TienVNV/Desktop/ProjectManager/web/src/graphql/mutations/tasks.ts`

```typescript
// UPDATE_TASK - General update mutation
mutation UpdateTask($input: UpdateTaskInput!) {
  update_task(input: $input) {
    task_id
    start_date
    due_date
    actual_start_date
    actual_end_date
    // ... other fields
  }
}

// UPDATE_TASK_STATUS - Status-specific mutation  
// UPDATE_TASK_EFFORT - Effort-specific mutation
// CREATE_TASK - New task creation
```

All mutations return the date fields in ISO format.

---

## REST API ENDPOINTS

### For Projects:

- **Create**: `POST /api/projects`
- **Update**: `PUT /api/projects/{id}`

Form data includes `start_date` and `due_date` as Date objects (JSON serialization happens automatically).

---

## Summary Table

| Component | File | Date Fields | Input Type | Nullable | GraphQL Mutation |
|-----------|------|-------------|-----------|----------|-----------------|
| TaskForm | TaskForm.tsx | startDate, deadline | date | Yes | UPDATE_TASK |
| TaskDetail | TaskDetail.tsx | start_date, due_date, actual_start_date, actual_end_date | date | Yes | UPDATE_TASK |
| NewTaskForm | NewTaskForm.tsx | startDate, dueDate | datetime-local | Yes | CREATE_TASK |
| TaskDetailPage | TaskDetailPage.tsx | (via child components) | date | Yes | UPDATE_TASK |
| TaskDetailsPanel | TaskDetailsPanel.tsx | start_date, due_date | date | Yes | UPDATE_TASK |
| DetailsTab | DetailsTab.tsx | start_date, due_date (editable), actual_start_date, actual_end_date (read-only) | date | Yes (editable only) | UPDATE_TASK |
| InlineEditableField | inline-editable-field.tsx | (generic) | date | Yes | (via callback) |
| ProjectForm | ProjectForm.tsx | start_date, due_date | date (DatePicker) | Yes | REST API |
| DatePicker | date-picker.tsx | (generic) | date (DayPicker) | Yes | (via callback) |

---

## Key Findings

1. **All date fields are optional** - can be set to null/empty
2. **Two input types used**:
   - `type="date"` - HTML5 date picker (YYYY-MM-DD format)
   - `type="datetime-local"` - HTML5 datetime picker (in NewTaskForm only)
   - Custom `DatePicker` component - for projects (uses react-day-picker)
3. **ISO 8601 format** - All dates converted to ISO format before sending to API
4. **Inline editing pattern** - Most task dates use inline click-to-edit with confirm/cancel buttons
5. **Modal dialogs** - TaskDetail uses a Dialog modal for comprehensive editing
6. **actual_start_date & actual_end_date** - Often read-only (not directly editable in UI, possibly set by backend)
7. **GraphQL mutations** - All task updates use `UPDATE_TASK` mutation
8. **REST API** - Projects use REST endpoints, not GraphQL
9. **Date display** - Uses Vietnamese locale formatting (date-fns 'vi-VN' locale)

---

## Unresolved Questions

1. Are `actual_start_date` and `actual_end_date` editable anywhere in the UI? (They appear read-only in current components)
2. What backend logic determines when actual_start_date/actual_end_date are set?
3. Are there any batch edit operations for dates across multiple tasks?
4. Date validation constraints (e.g., due_date must be after start_date)?
5. Timezone handling - all dates appear to be treated as local browser time
