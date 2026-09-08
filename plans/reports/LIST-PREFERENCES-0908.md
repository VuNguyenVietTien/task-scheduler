# LIST-PREFERENCES-0908

## Status

DONE

## Delivered

- Project/user-scoped List preferences persisted in defensive browser `localStorage`.
- Malformed, denied, unavailable, and SSR storage paths fall back safely.
- List-only default visibility hides `DONE`, `CLOSE`, `REJECTED`, and `ARCHIVED` roots.
- Complete descendants remain recursively visible beneath active roots; hidden roots never promote descendants.
- Explicit status filters continue to expose matching complete/archived roots.
- Columns picker drives both Normal and Excel projections.
- Excel selection, keyboard navigation, copy/paste, and rectangular TSV paste use visible columns only.
- Excel staged drafts survive column toggles.
- Start date uses canonical `start_date` in Normal and Excel, supports native date input and explicit clear, and applies authoritative mutation results to Redux/UI.
- No Kanban, Gantt, backend, or schema behavior changed.

## Field coverage

| Column | Normal | Excel | Save behavior |
|---|---|---|---|
| Title | Editable | Editable | Existing authoritative task update |
| Status | Editable | Editable | Existing Redux status thunk |
| Priority | Editable | Editable | Existing Redux priority thunk |
| Assignee | Editable | Editable | Canonical resource-member mutation result |
| Effort | Editable | Editable | Existing Redux effort thunk |
| Progress | Visible | Editable | Authoritative task update |
| Progress type | Editable | Editable | Stable catalog ID; authoritative task update |
| Category | Editable | Editable | Stable catalog ID; authoritative task update |
| Task type | Editable | Editable | Stable catalog ID; authoritative task update |
| Start date | Editable datepicker | Editable datepicker | Canonical `start_date`; empty clears to null |
| Planned end | Editable datepicker | Editable datepicker | Existing due-date Redux thunk |
| Actual start | Visible | Editable datepicker | Authoritative task update; empty clears |
| Actual end | Visible | Editable datepicker | Authoritative task update; empty clears |
| Tags | Visible | Editable comma-separated value | Authoritative task update |
| Created | Read-only | Read-only | Immutable metadata |
| Updated | Read-only | Read-only | Immutable metadata |
| Creator | Read-only | Read-only | Immutable metadata |

Description intentionally excluded from column settings.

## Focused verification

Command used required Jest config/reporter flags. The isolated worktree had no installed dependencies, so Jest was executed from the existing sibling installation with this worktree's config and sources.

- `TaskListView.assignment.test.tsx`: 13 passed
- `TaskExcelGrid.test.tsx`: 23 passed
- `task-status-visibility.test.ts`: 8 passed
- `task-list-visibility.test.ts`: 2 passed
- `task-list-preferences.test.ts`: 4 passed
- Combined focused run before final Start date integration test: 50 passed; final targeted Start date suite: 13 passed
- `git diff --check`: passed

## Limitations

- Preferences store visibility and filters only; no column reordering or custom-width UI.
- Normal mode keeps its established inline editing surface; additional mutable fields are bulk-editable in Excel mode.
- No backend preference sync by design.

## Unresolved questions

None.
