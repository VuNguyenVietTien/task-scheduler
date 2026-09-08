# EXCEL-PASTE-WIDTH-0908

Status: Implemented, committed, pushed.

Commit: `26541d2`

## Changes

- Added focused 2x3 CRLF/trailing-newline TSV paste coverage with six staged cells.
- Kept rectangular paste clipping and per-cell validation behavior unchanged.
- Fixed grid table layout and added explicit `<colgroup>` widths so number/select/date editors cannot resize columns.

## Validation

- `git diff --check`: passed.
- Focused Jest command attempted but dependencies are unavailable in this worktree (`jest` not recognized; no installed web dependencies).

## Unresolved questions

- None.
