# REALTIME-EXCEL

Status: DONE_WITH_CONCERNS

- Commit/push: `a176c59 fix(tasks): reconcile authoritative task updates` → `origin/codex/realtime-excel-0908`.
- Reused one shared List/Update GraphQL task fragment; update responses normalize once and recursively upsert by task ID, retaining tree order/children.
- Task modal now dispatches returned task before Gantt callback; List/Excel use returned task, not confirmed local status/field guesses.
- Excel preserves `scrollTop`/keyboard focus, shows cell-based unsaved count, retains failed edits, and guards dirty browser unload + in-app links + Normal switch.
- Added focused Redux contract/tree and Excel guard tests.

Tests: not runnable locally: `web/node_modules` junction absent (`jest` not found); `tsc`/`cargo` unavailable. `git diff --check` passed before commit.

Known browser feedback: unverified (unit-only requested).

Unresolved questions: none.
