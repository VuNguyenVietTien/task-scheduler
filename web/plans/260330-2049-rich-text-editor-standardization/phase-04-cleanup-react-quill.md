---
title: "Phase 04 — Remove React Quill Dependencies"
status: completed
priority: P2
effort: 0.5h
completed: 2026-03-30
---

# Phase 04 — Remove React Quill Dependencies

## Context Links

- `package.json`: `/Users/TienVNV/Desktop/ProjectManager/web/package.json`

## Overview

After phases 02 and 03 are complete and verified, remove React Quill and its plugins from the project to reduce bundle size.

## Key Insights

Current Quill-related packages in `package.json`:
```json
"quill-better-table": "^1.2.10",
"quill-blot-formatter": "^1.0.5",
"quill-magic-url": "^4.2.0",
"quill-table": "^1.0.0",
"react-quill": "^2.0.0"
```

Before removing, grep the entire codebase to confirm zero remaining imports.

## Implementation Steps

1. Verify no remaining React Quill imports:
   ```bash
   grep -r "react-quill\|quill-better-table\|quill-blot-formatter\|quill-magic-url\|quill-table\|ReactQuill" src/ --include="*.tsx" --include="*.ts"
   ```
   If any matches found — **stop and fix those files first**.

2. Uninstall packages:
   ```bash
   npm uninstall react-quill quill-better-table quill-blot-formatter quill-magic-url quill-table
   ```

3. Run build to verify no broken imports:
   ```bash
   npx tsc --noEmit
   ```

4. Run dev server briefly to confirm the app loads without errors.

## Todo List

- [x] Grep for any remaining `react-quill` / `ReactQuill` / `quill-*` imports
- [x] Confirm zero matches
- [x] `npm uninstall react-quill quill-better-table quill-blot-formatter quill-magic-url quill-table`
- [x] `npx tsc --noEmit` — confirm clean
- [x] Smoke test app in browser

## Success Criteria

- `package.json` has no `react-quill` or `quill-*` entries
- `node_modules` no longer contains these packages
- App builds and runs without errors
- Bundle size reduced (React Quill + Quill core ≈ ~300KB gzipped removed)

## Risk Assessment

- **Accidental removal**: Only remove after grep confirms zero usages — gate is hard
- **Lock file**: `package-lock.json` updated automatically by npm uninstall

## Security Considerations

N/A — dependency removal only.
