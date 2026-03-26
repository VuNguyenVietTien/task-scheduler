# Phase 4: Gantt Chart Button Responsiveness

## Context Links
- Timeline component: `src/components/timeline/Timeline.tsx` (lines 1054-1114)
- Plan management buttons: New Plan, Luu ke hoach, Delete, Sap xep tu dong

## Overview
- **Priority:** P2
- **Status:** complete
- **Description:** Plan management buttons in Gantt toolbar wrap and break text on small screens. Fix with flex-shrink-0 and whitespace-nowrap.

## Key Insights
- Buttons are in `<div className="flex gap-2 items-center">` (line 1054)
- Each button uses `px-3 py-1 rounded text-sm` but no whitespace/shrink control
- The select dropdown + 4 buttons + auto-sort button can overflow on <1280px screens
- Parent container has no `flex-wrap` or `overflow-x-auto`

## Requirements

### Functional
- Buttons never wrap text content
- On narrow screens, button group scrolls horizontally instead of wrapping

### Non-Functional
- No visual change on wide screens (>1280px)
- Touch-friendly horizontal scroll on tablets

## Related Code Files

### Modify
- `src/components/timeline/Timeline.tsx` - Lines 1054-1114 only

## Implementation Steps

1. **Add `whitespace-nowrap flex-shrink-0` to each button** (lines 1076-1113)
   - `<button ... className="flex items-center gap-1 px-3 py-1 rounded text-sm bg-slate-100 hover:bg-slate-200 whitespace-nowrap flex-shrink-0">`
   - Apply to all 4 buttons: New Plan, Luu ke hoach, Delete, Sap xep tu dong

2. **Add `overflow-x-auto` to parent container** (line 1054)
   - Change: `<div className="flex gap-2 items-center">`
   - To: `<div className="flex gap-2 items-center overflow-x-auto">`

3. **Add `flex-shrink-0` to the select dropdown** (line 1056)
   - Prevent dropdown from collapsing on narrow screens

## Todo List
- [ ] Add `whitespace-nowrap flex-shrink-0` to plan buttons
- [ ] Add `overflow-x-auto` to button group container
- [ ] Add `flex-shrink-0` to plan select dropdown
- [ ] Test on 1024px, 1280px, 1440px widths

## Success Criteria
- No text wrapping in plan buttons at any viewport width
- Horizontal scroll appears on narrow screens
- No change on wide screens

## Risk Assessment
- **Low risk** - CSS-only change, no logic changes

## Security Considerations
- None

## Next Steps
- None, standalone fix
