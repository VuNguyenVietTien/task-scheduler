# CATALOG-ACCESS-FAST

**Status:** DONE_WITH_CONCERNS
**Branch:** `codex/catalog-access-0908`

## Diagnosis

- Current `require_project_write` permits project owner or canonical `project_members.role` `manager`/`leader`/`admin`.
- UI normalizes `user_role` with `toLowerCase()` before `canManage`; access UI sends the canonical `resource_member_id`, and link-by-email does not grant role.
- The catalog resolver is byte-identical in `616fa28` and `db31fcb`; DB31 deployment cleared the stale-release dependency but did not itself change catalog authorization. If b24 still rejects Manager, capture the now-meaningful GraphQL error/code.

## Delivered

- `delete_project_catalog_item(catalog_item_id)` GraphQL API.
- One transaction: project write lock, catalog-item lock, kind-specific task ID + paired legacy-scalar clear, label/item delete, affected task IDs response.
- Per-item confirmed Delete UI, pending state, meaningful GraphQL error, catalog refetch, Redux task refetch for List/Gantt/detail.
- No migration, reset, or production data mutation.

## Focused coverage

- Backend catalog test: Manager create/update/reorder; Member/Guest denied; foreign-project delete denied; all three kinds delete and return affected IDs.
- Source/SDL contract: authorization, project/item lock ordering, three exact task-column pairs, transaction ordering, API payload.
- Frontend unit test: confirmation, stable catalog ID mutation payload, task refresh, meaningful GraphQL error.
- Existing member tests cover canonical resource ID/link flow; existing authority tests preserve owner/self/privileged-target protections.

## Checks

- PASS: source/SDL/UI contract script.
- PASS: `git diff --check`.
- BLOCKED: focused Jest unavailable (`web/node_modules/.bin/jest` absent).
- BLOCKED: Cargo/rustfmt unavailable on Windows.

## Release mapping

| Issue | Release-agent action | Acceptance |
|---|---|---|
| Manager catalog CRUD | Deploy this backend + web commit together | Manager can add/edit/reorder/delete Progress type, Category, Task type in b24. |
| Catalog delete consistency | Do not add migration/reset | Referenced tasks clear only the matching catalog ID and legacy scalar; List/Gantt/detail refresh. |
| Member Access | Verify linked permitted target only | UI sends `resource_member_id`; unlinked member role grant, owner/self/privileged target changes remain rejected. |
| Save failure feedback | Observe GraphQL code/message after deploy | UI shows permission/conflict/user-safe GraphQL message instead of generic Save failure. |

## Unresolved questions

- Restore the shared `web/node_modules` junction and Ubuntu Cargo runner, then run the focused Jest and Rust tests before release.
