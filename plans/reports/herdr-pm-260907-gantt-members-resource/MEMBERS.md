# MEMBERS handoff

Status: IMPLEMENTED_WITH_VERIFICATION_GAPS — source fixes complete; final independent review/populated migration fixtures still required.

## Canonical member outcome
- One physical `project_members` table; migration preserves both `member_id` and scheduling `resource_member_id`; `resource_members` becomes a read-only compatibility view.
- Resource assignment is authoritative. Task `assignee_id` is a validated linked-account mirror; unlinked `MEMBER` rows remain assignable.
- Link by ID/email atomically updates task account mirrors without changing resource IDs. User deletion clears canonical link/access before task mirrors.
- Revoke paths now set `role = NULL`; never delete canonical resource/configuration. Legacy add/owner/group grant paths create/reuse canonical rows rather than inserting incomplete duplicates.
- Access reads/listing/member projections use `role IS NOT NULL`; owner remains independently authorized. Legacy role updates now require project write access and reject self-escalation. New access mutation rejects omitted role and accepts explicit null revocation.

## Review fixes applied
Addressed current equivalents of `MIGRATION-PREVIEW.md` H1–H5, M1–M4:
- H1: single/bulk/legacy removes are role-only, project-scoped in bulk; task/config rows retained.
- H2: legacy updates/add/remove require shared write authorization; self role escalation/revocation rejected; new access API distinguishes omitted from null.
- H3: project/member/my-role legacy reads and listings exclude null-role links; canonical relation contract checked by runner readiness.
- H4: owner, legacy add-by-email, project-member add, and group access grant use canonical rows with generated resource/display IDs; linked/no-access rows are reused.
- H5/M2: both link mutations synchronize task mirrors in their transaction; account-delete trigger updates member link before task mirrors.
- M1: group trigger uses qualified column/renamed variable.
- M3: runner validates table/view kinds, nullability of identity/access fields, and required canonical constraints both for fingerprint representation and claimed-current readiness.
- M4: migration rejects existing invalid group/leave/commitment/capacity configuration; adds leave/commitment scope triggers and immutable project/kind member edges.

## Web
- `MembersView.tsx` is one canonical scheduling/member surface (resources, link-by-email, access, capacity, leave, groups, commitments).
- List assignment options use canonical `resource_member_id`; clear is explicit null; normal List and Excel display unlinked canonical names.
- Excel remains staged-save/discard/paste safe; root/received descendants flatten parent-first with stable IDs/depth. Focused test asserts descendant stable ID/save payload.

## Isolated DB evidence
Authorized only: `u-cf`, `pm-gm-rehearsal-20260907` (`pm.rehearsal.owner=TESTENV`), `127.0.0.1:55435/gm_rehearsal`.

- Rehearsed SQL SHA-256: `83FDE4D5E156125802D3578FE8DDAA815C6BC4298208C85537ED80E84843057F` (`evidence/members-20260907000001.sql`).
- Current un-rehearsed SQL SHA-256: `6484C09A8C602BD30A535EB532C000B8277FCCE7229251AB902CED5AF55E952A`.
- Earlier migration rehearsal: first SQL join error failed transactionally; corrected then applied successfully.
- Existing rehearsal final relation/count invariant: `project_members|r`, `resource_members|v`, `7|7|181|0` (canonical rows | view rows | tasks | account-mirror mismatches).
- Plans unchanged: `2|af29b9faa313ee2287aab2cb4c6adb4f`.
- Remote artifacts: `/home/azuraith/task-scheduler/rehearsals/gm-20260907/evidence/`.
- **Important:** only the old `83FDE4...43057F` schema/checksum was run. H/M fixes produced current `6484C...E952A`; per instruction it was not run on already-migrated baseline. A fresh/restored verified disposable target plus populated configuration fixtures is required.
- No member build/cargo process remains; remote build snapshots/artifacts are retained for reassignment.

## Validation
- `git diff --check`: PASS (only CRLF warnings).
- Isolated remote `cargo check`: PASS on latest source snapshot; output `members-cargo-check-latest.out`.
- Focused Jest: PASS — `TaskExcelGrid.test.tsx`, 13/13 tests. Used explicit transient config because repository configs are broken: `.js` references absent `jest-junit`; `.mjs` references absent `ts-jest`.
- Clean owned `web/node_modules`: provisioned once with `NODE_OPTIONS=--use-system-ca npm ci`; no sibling install/config mutated. npm reports 90 dependency audit vulnerabilities; not changed.
- Unfiltered `NODE_OPTIONS=--use-system-ca npx tsc --noEmit`: executed; fails on extensive pre-existing unrelated type/test/API incompatibilities. Initial current-file errors in `TaskListView.tsx` were corrected; full repo remains non-green.
- Whole `cargo fmt --all -- --check`: blocked by unrelated pre-existing formatting. Targeted changed Rust formatting applied where isolated; `scheduling.rs` still has baseline formatting diffs outside this scope.

## Clone boundary
Read `CLONE-SPEC.md` §§2,7. No clone implementation/API added. `child_tasks` public query is one level, so client recursion cannot prove arbitrary depth. Later CLONE node must add authorized flat `task_tree_rows` and use it for deep Excel/clone. Existing clone seams retained only.

## Required final proof
1. Freeze/hash current migration, independent review, run custom runner upgrade + bootstrap on separately verified disposable DB.
2. Populate capacity, override, individual/group leave, group, classification, commitment, owner/no-access/link/task fixtures; assert IDs/config/snapshot bytes and rollback/fault paths.
3. Mounted tests for owner create/read, revoke, self-grant denial, omitted/null access role, both link mirrors, user deletion, cross-project config, legacy add/group grant, and runner missing-view/constraint rejection.
4. Re-run web typecheck/focused List/member tests after baseline TypeScript/Jest configuration debt is repaired.

## Unresolved questions
- None product-level. Final migration fixtures and independent frozen-hash review remain required.
