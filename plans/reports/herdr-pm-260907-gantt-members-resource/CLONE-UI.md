# CLONE-UI implementation report

Task: CLONE-UI  
Status: **DONE_WITH_CONCERNS**  
Completed: 2026-09-07 Asia/Bangkok

## Delivered owned files

- `web/src/components/tasks/TaskCloneDialog.tsx` — new reusable checkbox-tree/quantity dialog; no network or transport decisions.
- `web/src/utils/cloneTask.ts` — pure clone tree/selection helpers added. Existing `cloneTaskSubtree` and its public compatibility types remain unchanged for current callers.
- `web/src/utils/__tests__/cloneTask.test.ts` — compatibility tests retained; pure projection/selection/quantity/payload tests added.
- `web/src/components/tasks/__tests__/TaskCloneDialog.test.tsx` — new focused dialog tests.

No TaskListView, ExcelGrid, GraphQL, backend, Gantt, members, hook, package manifest/config, plan, ledger, deployment, browser, DB, commit, or push changes.

## Exact dialog contract

```ts
export interface TaskCloneDialogProps {
  open: boolean;
  nodes: readonly CloneTreeNode[];
  sourceTaskId: string;
  loading?: boolean;                 // default false
  submitting?: boolean;              // default false
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (input: CloneTaskSelectionInput) => void | Promise<void>;
}
```

`onSubmit` receives exactly:

```ts
export interface CloneTaskSelectionInput {
  source_task_id: string;
  selected_descendant_ids: string[]; // parent-first projected order; root excluded
  quantity: number;
}
```

No copied task fields and no network call are produced by the dialog. Parent integrator owns mutation, refresh, close/success, conflict, and transport-ambiguity behavior. Rejected submit promises are contained; current selections/quantity remain available while `serverError` is displayed.

## Exact helper contracts

```ts
export interface CloneTreeNode {
  task_id: string;
  parent_task_id?: string | null;
  title: string;
  is_deleted?: boolean;
}

export interface CloneTreeItem { node: CloneTreeNode; depth: number }
export interface CloneTree { sourceTaskId: string; items: CloneTreeItem[] }
export interface ClonePreview { parentCount: number; childCount: number; totalCount: number }
```

- `buildCloneTree(nodes, sourceTaskId): CloneTree` — uses active rows (`is_deleted !== true`), input sibling order, parent-first traversal; first duplicate ID wins; unrelated rows/orphans/deleted branches excluded; visited guard prevents cycle hangs and duplicate output; no orphan promotion.
- `defaultCloneSelection(tree): Set<string>` — root and every projected descendant selected.
- `updateCloneSelection(tree, selected, taskId, checked): Set<string>` — uncheck removes full branch; check adds full branch plus ancestors; source root cannot be removed.
- `getCloneCheckboxState(tree, selected, taskId): { checked, indeterminate }` — partial descendant selection reported indeterminate.
- `parseCloneQuantity(value): number | null` — only positive `Number.isSafeInteger`; no product cap.
- `getClonePreview(selectedCount, quantity): ClonePreview` — selected count includes required source root.
- `createCloneSelectionInput(tree, selected, quantity): CloneTaskSelectionInput` — root excluded from descendants; no copied fields.

Dialog behavior: root checked/disabled with “Parent is always copied.”; active subtree initially checked; native required `type=number`, `min=1`, `step=1`; exact invalid message “Enter a whole number greater than 0.”; parent-only valid; partial branches indeterminate; confirm shows copy/task count; submitting blocks duplicate confirm and close; loading/unavailable/error states labeled accessibly. Example selecting 3 of 6 children at quantity 3 displays `3 parents + 9 children = 12 tasks` and emits those three descendant IDs plus quantity 3.

## Verification

- PASS: `npm test -- --config jest.config.js --reporters=default --runInBand src/utils/__tests__/cloneTask.test.ts src/components/tasks/__tests__/TaskCloneDialog.test.tsx`
  - 2 suites, 28 tests, 0 failures.
  - Covers old `cloneTaskSubtree` compatibility, nested hierarchy, active filtering, duplicate/orphan/cycle safety, defaults, full selection, branch removal, ancestor restoration, partial state, parent-only selection, exact 3/9/12 payload/preview, invalid and maximum-safe quantities, server error state, loading/unavailable state, submitting and duplicate-confirm prevention.
- PASS: `git diff --check` for all four owned files.
- Unfiltered `npx tsc --noEmit --pretty false`: FAIL (`exit 2`) on numerous existing unrelated files. Filtered output reports **no owned-file errors** for `TaskCloneDialog` or `utils/cloneTask`.
- Focused ESLint could not start because existing `.eslintrc.json` extends unavailable `next/typescript`. No config/package change made.

## Tooling concerns / limitations

- Plain `npm test` is currently blocked by two existing Jest configs. `jest.config.mjs` additionally requires absent `ts-jest`; `jest.config.js` references absent `jest-junit`. Focused tests passed by explicitly selecting `jest.config.js` and overriding reporter to `default`.
- Locked `npm ci` succeeded inside `web` with `NODE_OPTIONS=--use-system-ca`; lock/manifest unchanged. npm reported 90 existing dependency vulnerabilities (5 low, 50 moderate, 30 high, 5 critical); not altered in this scope.
- Root README and referenced `.claude/rules/development-rules.md` were absent in primary/worktree. Current primary `AGENTS.md` and mandated authority docs were read.
- This is UI/pure selection only. No end-to-end clone, API atomicity, persistence, List/Excel wiring, refresh, or browser verification claim.

## Remaining CLONE integration

1. Integrator imports `TaskCloneDialog`, supplies final flat active task rows and clicked `sourceTaskId`.
2. Integrator passes emitted `CloneTaskSelectionInput` directly to the additive clone mutation input.
3. Integrator controls `loading`, `submitting`, `serverError`, refresh/transport ambiguity, success close/toast, and normal/Excel launch points.
4. Backend/API/final tests must prove atomic writes, authorization, copied/reset fields, unique IDs, parent remap, persistence, and rollback.

## Process cleanup

- Preflight found only unrelated Codex processes and Jest in another worktree; none stopped.
- `npm ci`, Jest, TypeScript, and ESLint commands started here all exited.
- Final owned-process check for `clone-dialog-20260907`: none.

## Unresolved questions

None.
