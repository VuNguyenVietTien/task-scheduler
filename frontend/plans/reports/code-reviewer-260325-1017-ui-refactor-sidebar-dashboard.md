# Code Review: UI Refactor (Sidebar + Dashboard) - 5 Phases

## Scope
- Files: 16 files across 5 phases
- Focus: Bugs, logic errors, security issues (high-confidence only)

## Overall Assessment
Implementation is solid overall. Clean component separation, proper hooks usage, good loading/error states. Found 4 high-priority issues and 2 critical issues that need fixing.

---

## Critical Issues

### C1. Dashboard page calls hooks conditionally (Rules of Hooks violation)

**File:** `src/app/dashboard/page.tsx` (line 13-18)

```tsx
if (!user) {
  router.push('/auth');
  return null;
}
// hooks called AFTER early return:
const { loading, ... } = useDashboardTasks(user.id, user.role);
```

**Problem:** `useDashboardTasks` is called after a conditional return. React hooks must be called in the same order on every render. When `user` is null, the hook is skipped, then when `user` becomes non-null, React sees a different number of hooks and will crash with "Rendered fewer hooks than expected."

**Fix:** Move the `useDashboardTasks` call above the early return, passing empty/default values when `user` is null:
```tsx
const { loading, ... } = useDashboardTasks(user?.id || '', user?.role || 'member');
if (!user) { router.push('/auth'); return null; }
```

### C2. Duplicate column keys cause React key warnings and potential rendering bugs

**File:** `src/components/dashboard/pm-dashboard-view.tsx` (lines 48-53)

The overdue tasks table has two columns with `key: 'dueDate'`:
```tsx
{ key: 'dueDate', label: 'Han', render: ... },
{ key: 'dueDate', label: 'Tre (ngay)', render: ... },
```

In `dashboard-task-table.tsx` line 94, `col.key` is used as React's `key` prop:
```tsx
<td key={col.key} ...>
```

**Problem:** Duplicate React keys within the same row. React may skip rendering one of the two `<td>` elements or produce incorrect reconciliation. The "Tre (ngay)" column could silently disappear or show the wrong data.

**Fix:** Add a unique `id` field to Column interface or use index-based key, or rename one key to `dueDateOverdue`.

---

## High Priority Issues

### H1. localStorage persistence saves empty Set on first render (data loss)

**File:** `src/hooks/use-sidebar-state.ts` (lines 14-36)

Two `useEffect` hooks: one reads from localStorage, one writes. On first mount, the state is `new Set()` (empty). The write effect runs immediately with this empty set, **overwriting** any previously stored expanded state before the read effect restores it.

Both effects have `[]` or `[expandedProjects]` as deps. On mount:
1. State initializes to `new Set()` (empty)
2. Write effect fires with `expandedProjects = empty Set` -> overwrites localStorage
3. Read effect fires -> reads the now-empty localStorage

**Fix:** Use lazy initialization instead of useEffect for reading:
```tsx
const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
});
```
This avoids the race condition entirely. Note: wrap in `typeof window !== 'undefined'` check for SSR safety.

### H2. `initialTab` is not validated against ViewType union

**File:** `src/components/projects/ProjectDetailView.tsx` (line 30)

```tsx
const [activeView, setActiveView] = useState<ViewType>((initialTab as ViewType) || 'list');
```

And line 34-36:
```tsx
useEffect(() => {
  if (initialTab && initialTab !== activeView) {
    setActiveView(initialTab as ViewType);
  }
}, [initialTab]);
```

**Problem:** Any arbitrary string from the URL `?tab=XSS_PAYLOAD` is cast to `ViewType` without validation. While this won't cause XSS (the string is only compared, not rendered), it means `activeView` could be set to an invalid value like `'malicious'`, causing the view to render nothing (blank screen) since none of the conditional blocks match.

**Fix:** Validate against allowed values:
```tsx
const VALID_TABS: ViewType[] = ['list', 'kanban', 'gantt', 'members', 'report'];
const validatedTab = VALID_TABS.includes(initialTab as ViewType) ? (initialTab as ViewType) : 'list';
```

### H3. `useEffect` for syncing `initialTab` missing `activeView` in dependency array

**File:** `src/components/projects/ProjectDetailView.tsx` (lines 33-37)

```tsx
useEffect(() => {
  if (initialTab && initialTab !== activeView) {
    setActiveView(initialTab as ViewType);
  }
}, [initialTab]); // Missing activeView
```

**Problem:** React linter will warn about missing dependency. More importantly, this effect references `activeView` but doesn't list it as a dep. The stale closure means the comparison `initialTab !== activeView` may use an outdated `activeView` value, potentially causing the tab to not sync correctly when the user manually switches tabs and then clicks a sidebar link to the same project but different tab.

**Fix:** Add `activeView` to deps, or better, remove the comparison and always set:
```tsx
useEffect(() => {
  if (initialTab) {
    setActiveView(validatedTab); // use validated value from H2 fix
  }
}, [initialTab]);
```

### H4. `router.push` in render body without useEffect

**File:** `src/app/dashboard/page.tsx` (line 14)

```tsx
if (!user) {
  router.push('/auth');
  return null;
}
```

**Problem:** `router.push` is called during render, not inside a `useEffect`. This can cause "Cannot update a component while rendering a different component" warnings in React 18 strict mode. It also runs on every render cycle when user is null.

**Fix:** Wrap in useEffect or use a redirect component pattern.

---

## Medium Priority Issues

### M1. `DashboardSummaryCard` color prop accepts arbitrary CSS classes

**File:** `src/components/dashboard/dashboard-summary-card.tsx` (line 8, 19)

The `color` prop is interpolated directly into className. Not a security risk in this context (server-rendered Tailwind), but it means any invalid class string will silently produce unstyled output. Consider using a constrained union type.

### M2. Excessive console.log statements in production code

**File:** `src/components/projects/ProjectDetailView.tsx` (lines 70, 80, 93, 100, 107, 141, 147, 159, 163, 222, 256-263)

Over 10 `console.log` calls including debug data that exposes internal state. Should be removed or gated behind `process.env.NODE_ENV === 'development'`.

---

## Positive Observations
- Clean hook extraction (`useSidebarState`, `useDashboardTasks`)
- Proper loading skeletons and empty states
- Good use of `useMemo` for derived dashboard data
- PM/Member role split is cleanly separated into distinct view components
- Sidebar tree item correctly handles expand/collapse with accessibility (`aria-expanded`)

---

## Summary of Required Fixes

| ID | Severity | File | Issue |
|----|----------|------|-------|
| C1 | CRITICAL | dashboard/page.tsx | Hooks called after conditional return |
| C2 | CRITICAL | pm-dashboard-view.tsx | Duplicate React keys in table columns |
| H1 | HIGH | use-sidebar-state.ts | localStorage overwritten on mount |
| H2 | HIGH | ProjectDetailView.tsx | Unvalidated URL tab parameter |
| H3 | HIGH | ProjectDetailView.tsx | Missing useEffect dependency |
| H4 | HIGH | dashboard/page.tsx | router.push during render |
| M2 | MEDIUM | ProjectDetailView.tsx | Excessive console.log in production |

## Unresolved Questions
- Does the GraphQL `tasks(assigneeId: ID)` query return tasks across ALL projects? If so, the PM dashboard shows all tasks globally, which may be intentional but should be confirmed.
- Is `user.role` a global role or project-scoped? The dashboard uses it for PM detection but project detail uses `project.userRole` -- these could diverge.
