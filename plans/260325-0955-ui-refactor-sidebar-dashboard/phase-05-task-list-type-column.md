# Phase 5: Task List Type Column

## Context Links
- TaskListView: `src/components/tasks/TaskListView.tsx` (thead at lines 1129-1164)
- Task types: `src/types/task.ts` line 4: `TaskType = 'Feature' | 'Bug' | 'Enhancement' | 'Documentation'`
- GraphQL query already returns `type` field: `src/graphql/queries/tasks.ts` line 29
- ProjectDetailView transform: `src/components/projects/ProjectDetailView.tsx` line 192: `type: task.type`

## Overview
- **Priority:** P2
- **Status:** complete
- **Description:** Add a "Type" column to TaskListView table with colored badges for Bug, Feature, Enhancement, Documentation.

## Key Insights
- `type` field already exists on Task type and is fetched via GraphQL
- `TASK_TYPES` constant already defined in `src/types/task.ts`
- The transform function in ProjectDetailView already maps `type` field
- Current table has 7 columns: checkbox, title, status, priority, assignee, due date, effort, actions
- Insert Type column after Priority column (position 4)

## Requirements

### Functional
- New "Loai" (Type) column in task list table between Priority and Assignee columns
- Colored badge per type:
  - Bug: red badge (`bg-red-100 text-red-800`)
  - Feature: blue badge (`bg-blue-100 text-blue-800`)
  - Enhancement: purple badge (`bg-purple-100 text-purple-800`)
  - Documentation: green badge (`bg-green-100 text-green-800`)
- Show dash or empty when type is null/undefined
- Badge text: display the type value as-is (already capitalized)

### Non-Functional
- Column width: `w-24` or auto
- Consistent badge style with existing status/priority badges in codebase

## Related Code Files

### Modify
- `src/components/tasks/TaskListView.tsx` - Add `<th>` in thead + `<td>` in tbody

### No Change
- `src/types/task.ts` - TaskType already defined
- `src/graphql/queries/tasks.ts` - `type` already in query
- `src/components/projects/ProjectDetailView.tsx` - `type` already transformed

## Implementation Steps

1. **Add type badge color map** (near top of TaskListView.tsx)
   ```typescript
   const TYPE_BADGE_COLORS: Record<string, string> = {
     'Bug': 'bg-red-100 text-red-800',
     'Feature': 'bg-blue-100 text-blue-800',
     'Enhancement': 'bg-purple-100 text-purple-800',
     'Documentation': 'bg-green-100 text-green-800',
   };
   ```

2. **Add `<th>` for Type column** (after Priority th, ~line 1149)
   ```html
   <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
     Loai
   </th>
   ```

3. **Add `<td>` for Type column in row render** (after Priority td)
   ```html
   <td className="px-3 py-3 whitespace-nowrap">
     {task.type ? (
       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_COLORS[task.type] || 'bg-gray-100 text-gray-800'}`}>
         {task.type}
       </span>
     ) : (
       <span className="text-slate-400">-</span>
     )}
   </td>
   ```

4. **Add Type column to child/subtask rows too** (if subtasks render in same table)

## Todo List
- [ ] Add `TYPE_BADGE_COLORS` constant
- [ ] Add `<th>` header for Type column
- [ ] Add `<td>` with badge rendering in task rows
- [ ] Add Type column to subtask rows if applicable
- [ ] Test with tasks that have type set
- [ ] Test with tasks that have no type (null display)

## Success Criteria
- Type column visible in task list table
- Colored badges render correctly for all 4 types
- Null/undefined type shows dash
- Column alignment consistent with other columns
- No horizontal overflow issues

## Risk Assessment
- **Risk:** Table too wide with extra column on small screens → **Mitigation:** Column uses minimal width (`px-3`), table already has `min-w-full` with horizontal scroll
- **Low risk** overall - additive change only

## Security Considerations
- None; type is a display-only field from existing data

## Next Steps
- Consider adding type column to Kanban card view in future iteration
