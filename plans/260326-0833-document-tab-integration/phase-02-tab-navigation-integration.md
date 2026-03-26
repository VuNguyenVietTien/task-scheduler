# Phase 2: Tab Navigation Integration

## Context Links
- [sidebar-project-tree-item.tsx](../../frontend/src/components/ui/navigation/sidebar-project-tree-item.tsx) - SUB_TABS array
- [ProjectDetailView.tsx](../../frontend/src/components/projects/ProjectDetailView.tsx) - ViewType + tab rendering

## Overview
- **Priority**: High
- **Status**: complete
- **Description**: Add "documents" to sidebar tree SUB_TABS and ViewType union in ProjectDetailView

## Key Insights
- SUB_TABS is a static array at line 20-26 in `sidebar-project-tree-item.tsx`
- ViewType is a union type at line 21 in `ProjectDetailView.tsx`
- VALID_VIEWS array at line 22 validates URL `?tab=` param
- Tab rendering uses conditional blocks in JSX (lines 324-365)
- `max-h-60` on the sub-tabs container may need increase to `max-h-72` to fit 6 tabs

## Requirements

### Functional
- "Tai lieu" (Documents) tab appears in sidebar under each project
- Clicking navigates to `/projects/{id}?tab=documents`
- Tab is validated and rendered in ProjectDetailView

### Non-functional
- No layout shift when adding 6th tab
- Icon should be a document/file icon (SVG path)

## Architecture
No new architecture; extending existing tab system.

## Related Code Files

### Modify
- `frontend/src/components/ui/navigation/sidebar-project-tree-item.tsx`
  - Add entry to SUB_TABS array
  - Increase `max-h-60` to `max-h-72` if needed
- `frontend/src/components/projects/ProjectDetailView.tsx`
  - Add `'documents'` to ViewType union
  - Add `'documents'` to VALID_VIEWS array
  - Add conditional rendering block for documents view

## Implementation Steps

1. **sidebar-project-tree-item.tsx** - Add documents tab to SUB_TABS:
   ```typescript
   { id: 'documents', label: 'Tai lieu', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' }
   ```
   - Insert after `report` entry (last position)
   - Update `max-h-60` to `max-h-72` in the overflow container (line 63)

2. **ProjectDetailView.tsx** - Extend ViewType:
   - Change line 21: `type ViewType = 'list' | 'kanban' | 'gantt' | 'members' | 'report' | 'documents';`
   - Change line 22: `const VALID_VIEWS: ViewType[] = ['list', 'kanban', 'gantt', 'members', 'report', 'documents'];`
   - Add import: `import { DocumentsTab } from '@/components/projects/DocumentsTab';`
   - Add rendering block after the `report` condition (before the loading/empty checks):
     ```tsx
     activeView === 'documents' ? (
       <DocumentsTab projectId={project.id} />
     ) :
     ```

## Todo List
- [x] Add documents entry to SUB_TABS in sidebar
- [x] Update max-h class for expanded sub-tabs
- [x] Add 'documents' to ViewType and VALID_VIEWS
- [x] Add DocumentsTab import and conditional render
- [x] Verify URL navigation `/projects/{id}?tab=documents` works

## Success Criteria
- "Tai lieu" tab visible in sidebar tree for every project
- Clicking tab navigates correctly and renders DocumentsTab component
- Other tabs unaffected

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sidebar height overflow with 6 tabs | Low | Low | Increase max-h class |
| DocumentsTab import before component exists | N/A | N/A | Phase 3 creates it; implement Phase 2+3 together |

## Security Considerations
- No new auth surface; tab just renders a component

## Next Steps
- Phase 3: Create DocumentsTab component
