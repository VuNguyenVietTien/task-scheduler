# Phase 1: Make actual_start/actual_end Editable in TaskDetail Modal

## Context Links
- TaskDetail modal: `frontend/src/components/tasks/TaskDetail.tsx`
- InlineEditableField: `frontend/src/components/tasks/inline-editable-field.tsx`
- useUpdateTask hook: `frontend/src/hooks/useTasks.ts`
- Backend UpdateTaskInput: `backend/src/graphql/types/task.rs` (lines 232-252)

## Overview
- **Priority**: P2
- **Status**: complete
- **Description**: Add `actual_start_date` and `actual_end_date` as inline-editable date fields in the TaskDetail modal dialog

## Key Insights
- Backend `UpdateTaskInput` already has `actual_start_date` and `actual_end_date` fields
- `useUpdateTask` hook already maps these fields to GraphQL `actualStartDate`/`actualEndDate`
- TaskDetail modal uses `InlineEditableField` for start_date, due_date — same pattern applies
- `handleFieldSave` switch statement (line 250-259) needs two new cases

## Requirements
### Functional
- actual_start_date and actual_end_date appear in the detail grid as date pickers
- Inline editing: click to edit, blur/Enter to save
- Clearing a date sets it to null

### Non-functional
- No backend changes needed

## Related Code Files
### Modify
- `frontend/src/components/tasks/TaskDetail.tsx` — add actual_start_date/actual_end_date fields

### No changes needed
- Backend mutation already supports these fields
- useUpdateTask hook already handles the mapping

## Implementation Steps

1. **Add cases to `handleFieldSave`** (around line 255 in TaskDetail.tsx):
   ```typescript
   case 'actual_start_date': updates.actual_start_date = value ? `${value}T00:00:00Z` : undefined; break;
   case 'actual_end_date': updates.actual_end_date = value ? `${value}T00:00:00Z` : undefined; break;
   ```

2. **Add two InlineEditableField blocks** in the detail grid section (after the due_date field, around line 464):
   ```tsx
   {/* Actual start date */}
   <div>
     <span className="text-xs text-slate-500 block mb-1">Ngay bat dau thuc te</span>
     <InlineEditableField
       value={task.actual_start_date?.split('T')[0] || ''}
       onSave={(v) => handleFieldSave('actual_start_date', v)}
       type="date"
       saving={savingField === 'actual_start_date'}
       placeholder="Chon ngay"
       renderDisplay={(v) => <span>{v ? new Date(v).toLocaleDateString('vi-VN') : <span className="text-slate-400 italic">Chua bat dau</span>}</span>}
     />
   </div>

   {/* Actual end date */}
   <div>
     <span className="text-xs text-slate-500 block mb-1">Ngay ket thuc thuc te</span>
     <InlineEditableField
       value={task.actual_end_date?.split('T')[0] || ''}
       onSave={(v) => handleFieldSave('actual_end_date', v)}
       type="date"
       saving={savingField === 'actual_end_date'}
       placeholder="Chon ngay"
       renderDisplay={(v) => <span>{v ? new Date(v).toLocaleDateString('vi-VN') : <span className="text-slate-400 italic">Chua hoan thanh</span>}</span>}
     />
   </div>
   ```

## Todo List
- [ ] Add `actual_start_date` and `actual_end_date` cases to `handleFieldSave`
- [ ] Add two InlineEditableField blocks in detail grid
- [ ] Verify save works via GraphQL mutation
- [ ] Test clearing dates (setting to null)

## Success Criteria
- Clicking actual_start/end values opens date picker
- Saving updates via GraphQL mutation and reflects in UI
- Clearing date sends null to backend

## Risk Assessment
- Low risk — follows exact same pattern as start_date/due_date fields

## Security Considerations
- No new inputs beyond what backend already validates

## Next Steps
- Phase 2: apply same change to the full-page TaskDetailPage.tsx
