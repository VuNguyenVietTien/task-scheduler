# Phase 2: Make actual_start/actual_end Editable in TaskDetailPage (Full Page)

## Context Links
- TaskDetailPage: `frontend/src/components/tasks/TaskDetailPage.tsx` (~26K tokens)
- Actual dates rendered read-only at lines 1939-1951

## Overview
- **Priority**: P2
- **Status**: complete
- **Description**: Replace read-only actual_start/end display in full task detail page with inline-editable date fields

## Key Insights
- TaskDetailPage.tsx is a large file (~800+ lines). The actual dates are at lines 1939-1951
- The page already has editable fields for other properties but uses a different editing pattern (dedicated inline components within the page)
- Need to identify the page's field update mechanism to hook into it

## Requirements
### Functional
- actual_start_date and actual_end_date shown as editable date fields (same as other date fields on page)
- Click to edit, save on confirm

### Non-functional
- Keep consistent with existing page editing patterns

## Related Code Files
### Modify
- `frontend/src/components/tasks/TaskDetailPage.tsx` — replace read-only actual date display with editable date fields

## Implementation Steps

1. **Investigate TaskDetailPage editing pattern**: read the section around the start_date/due_date fields to understand how editing works on the full page (different from TaskDetail modal)

2. **Replace actual_start_date display** (line 1940-1943): replace static text with an editable date component matching the pattern used for start_date/due_date

3. **Replace actual_end_date display** (line 1947-1950): same approach

4. **Wire up the update handler**: ensure the page's `onTaskUpdate` callback includes actual_start_date/actual_end_date in the update payload

## Todo List
- [ ] Read TaskDetailPage around lines 1900-1960 to understand editing pattern for dates
- [ ] Replace actual_start_date read-only text with editable date field
- [ ] Replace actual_end_date read-only text with editable date field
- [ ] Test save/clear behavior

## Success Criteria
- Full task detail page shows editable actual start/end dates
- Saving updates backend via existing mutation
- UI pattern consistent with other editable fields on the page

## Risk Assessment
- Medium — large file, need to match existing patterns carefully
- File exceeds 200-line guideline; consider if modularization needed

## Security Considerations
- None — reuses existing update mechanisms

## Next Steps
- Phase 3: add task edit modal to KanbanBoard
