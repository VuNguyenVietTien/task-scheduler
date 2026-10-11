# MIGRATION-PREVIEW — preliminary bounded review

Task: MIGRATION-PREVIEW · independent data-integrity reviewer · 2026-09-07 Asia/Bangkok
Status: **DONE_WITH_CONCERNS**. **Not final approval or release authorization.** Writer still active; findings apply to observed source.

## Snapshot / scope

Migration: isolated worktree `backend/migrations/20260907000001_consolidate_project_members.sql`, 19,404 bytes.

| Observation | Asia/Bangkok time | SHA-256 |
|---|---|---|
| Start | `2026-09-07T13:38:02.5512763+07:00` | `83FDE4D5E156125802D3578FE8DDAA815C6BC4298208C85537ED80E84843057F` |
| Reviewed-source end | `2026-09-07T13:46:35.5453099+07:00` | `83FDE4D5E156125802D3578FE8DDAA815C6BC4298208C85537ED80E84843057F` |
| Finalization end — UNREVIEWED EDIT | `2026-09-07T13:48:33.8103758+07:00` | `795243504F765CF50F0F89F0BE2E48D4F503CE6DE10B1791BFCAC3F6E3A2D1A7` |

**Concurrent edit detected at finalization.** The 19,404-byte reviewed snapshot stayed unchanged through 13:46:35, but the final hash differs. Findings/line numbers below apply ONLY to reviewed hash `83FDE4D5...43057F`; the newer `79524350...A2D1A7` migration was NOT reread or approved. Some findings may already be addressed by the active writer. Stop here per bounded-review deadline; PM must dispatch final independent review on frozen artifacts. Checkpoint saved **13:41:44**, within five minutes; preliminary final saved **13:48:00**, then this concurrency notice added.

Read primary AGENTS/startup authority docs, plan/acceptance/decisions, DESIGN/TESTENV/MEMBERS; scoped migration/schema, identity normalizer and mounted member/project/task/scheduling consumers. Root README and primary development-rules file absent; available user-global rules read. Applied `ak-code-review` and PostgreSQL guidance. No DB/network/test/deployment/process-management/subagent operations. Only this report written.

Paths below are worktree-relative; `SQL` means the migration above, `R` means `backend/src/graphql/resolvers/`; `DESIGN` means the primary accepted `DESIGN.md`. Both legacy member resolver families are mounted (`backend/src/graphql/schema.rs:23-56`); fixing only the new resource API is insufficient.

## Actionable blockers — static evidence, not executed reproductions

### H1 — Legacy revoke still physically deletes resource identity/configuration

**Evidence:** `R/members/mutation/remove.rs:29-39`, `R/project_member.rs:293-303`; SQL `:285-298`. Both single-remove implementations DELETE canonical rows. Retargeted capacity/leave/group-membership/classification FKs retain CASCADE; only the task FK becomes RESTRICT.

**Counterexample:** linked non-privileged member with capacity/individual leave/group membership and no task: revoke destroys those records and both identity handles. With an assigned task, revoke instead fails on RESTRICT. Replace legacy deletion with authorized role-only revocation. Bulk still contains DELETE (`R/members/mutation/bulk_remove.rs:60-84`); its separate Claims-context reachability was not proven here.

**Invariant:** DESIGN `:21,59-61,127` — revoke preserves identity, assignments and resource configuration.

### H2 — Linked/no-access users can grant themselves access through retained mutation

**Evidence:** `R/members/mutation/update.rs:15-51`, `R/project_member.rs:227-265`: neither implementation checks caller/project authority before `SET role`. A linked account with NULL role can request its own `manager` role; the new shared read guard cannot prevent this mutation.

The new replacement is also incomplete: `R/resource_members/mod.rs:384-419` accepts omitted role as `None` and revokes it, and its scheduling-write guard permits leaders to revoke privileged peers without the existing single-remove restriction (`R/members/mutation/remove.rs:13-26`). Route retained/new access operations through the same authorized access policy; reject omitted role, distinguish explicit NULL, retain peer/owner restrictions.

**Invariant:** DESIGN `:116,120,126-128` — explicit access action, no privilege elevation through linking, protected administration.

### H3 — NULL-role rows break project/member reads; listing still grants visibility

**Evidence:** `R/project.rs:100-114,129-139` and `R/members/query/get_members.rs:24-37` read every linked row, then `Row::get` decodes role into non-null `MemberRole` (`backend/src/graphql/types/project.rs:86-89`). A linked/no-access or migration-synthesized owner row causes a NULL decode panic, including an authorized owner's project read. Both legacy query families have this shape; `R/members/query/my_role.rs:41-48` likewise decodes NULL.

Separately, `R/project.rs:241-245` lists project details for any linked user, regardless of NULL role; `:35-44` retains the same access predicate. Thus linking/revocation is not access-neutral even though shared `project_authz` was fixed. Use access-only projections, nullable role decoding where appropriate, and owner-or-nonnull-role predicates/counts.

**Invariant:** DESIGN `:50,82,128` — owner access independent of role; scheduling link is not access.

### H4 — Ordinary project creation and legacy adds fail after migration

**Evidence:** SQL `:111-121,251-253` makes resource ID/display name mandatory without defaults. `R/project.rs:465-483` still inserts owner membership with neither column, so every ordinary project creation rolls back. Same invalid insert shape remains in `R/project_member.rs:183-189`, `R/members/mutation/add_by_email.rs:86-92`, and group grant `R/scheduling.rs:748-750` (ON CONFLICT does not bypass NOT NULL checks).

Legacy add also treats linked/no-access presence as already granted rather than reusing it (`add_by_email.rs:48-61`). Update these mounted writes to create/reuse canonical identity, including atomic owner creation.

**Invariant:** DESIGN `:82,127` — owner identities and compatible legacy/group access APIs.

### H5 — Linking an assigned placeholder commits inconsistent task mirrors

**Evidence:** `R/resource_members/mod.rs:286-295,364-374` updates member user and commits without updating assigned tasks. SQL `:379-387` validates only task writes, not member changes.

**Counterexample:** task `(resource=R,user=NULL)`; link R to U; task remains `(R,NULL)` although R now has U. Next ordinary `update_task`, even title-only, includes both assignment columns (`R/tasks/mutation/update.rs:90-92`) and fails the trigger. Synchronize mirrors in the link transaction, retaining R/configs and saved JSON.

**Invariant:** DESIGN `:125,147` — link atomically updates legacy mirrors; IDs/assignments preserved.

### M1 — Group-member trigger fails on its first normal insert

**Evidence:** SQL `:391-395` declares variable `member_kind` and selects unqualified `member_kind` from `project_members`, which also has that column. PostgreSQL's standard `plpgsql.variable_conflict=error` raises ambiguous-column error when this statement executes. Mounted group add reaches it at `R/scheduling.rs:664-672`.

Qualify the column/rename the variable. Successful migration creation does not execute this branch. **Invariant:** DESIGN `:61` and acceptance Existing workflows — groups remain usable.

### M2 — Account-unlink trigger clears task mirror before clearing linked identity

**Evidence:** SQL `:356-359` updates tasks first; their constraint trigger is INITIALLY IMMEDIATE (`:379-387`). For a linked assigned account, the nested task UPDATE observes the still-linked canonical user and rejects NULL, so account deletion rolls back before unlinking. Order/defer this operation so validation observes consistent identity/mirrors; test an otherwise deletable non-owner account.

**Invariant:** DESIGN `:53,147` — account deletion clears access/link/mirrors atomically without losing scheduling data.

### M3 — Runner readiness does not enforce the canonical fingerprint

**Evidence:** `backend/src/migration_runner.rs:1084-1100` checks only presence of V9's named tables before returning Current. V9 excludes `resource_members`; the relation-kind check at `:695-703` is called only by `represented_version` (`:746-750`), not readiness. With intact history, a missing compatibility view still reports Current. Baseline fingerprint `:645-662,718-750` also checks neither required constraints nor nullable role/user semantics.

Use the canonical contract checks for readiness and baseline. **Invariant:** DESIGN `:65` — fingerprint asserts canonical columns, constraints and base-table/view kinds, not names alone.

### M4 — Cross-project configuration invariants remain unenforced/unvalidated

**Evidence:** SQL `:267-301` retargets single-column FKs; `:389-437` adds only group-member/classification/capacity row triggers. There is no leave/commitment project validation or canonical member project/kind-change guard. Existing leave/commitment schema checks only shape/FK existence (`backend/migrations/20260905000001_create_scheduling_config.sql:44-85`).

**Counterexamples:** individual leave in project A targeting member B is accepted; changing an assigned NULL-role member to COMPANY leaves a non-MEMBER assignee. Existing invalid group/classification/capacity rows also are not checked just by creating row triggers. Add the mandated boundary checks and preflight validation. This is a demonstrated schema gap, **not a claim production contains these rows**.

**Invariant:** DESIGN `:61,71,85` — same-project relationships, immutable valid identity edges, fail-closed source validation.

## What inspection supports / does not certify

- SQL alters the existing base table, preserves old access IDs and maps old resource IDs through two handles; ordinary P-only/R-only/exact/email-pair mapping and owner/legacy-account synthesis are present (`:124-228`). No fabricated users, plan JSON rewrite, or second stored member copy found; final `resource_members` is a non-materialized VIEW (`:440-445`). Physical consolidation remains the accepted solution.
- Task backfill covers legacy user-only rows including soft-deleted tasks (`:302-329`). `project_member_identity.rs:29-92` implements the update assignment matrix's omitted/NULL/value distinctions and same-project MEMBER/mirror checks; update preserves omitted parent. These are source observations, not persistence/concurrency proof.
- PUBLIC view DML is revoked, but actual application-role privileges/view writability were not verified. Historical migration checksums, exhaustive catalog dependencies, metadata/ID reconciliation and snapshot/config hashes were not independently compared. No claim of observed UUID collision, lost snapshot bytes or existing production corruption.

## Tests needed / unreviewed areas

1. Freeze/hash final SQL and backend; rerun actual custom runner upgrade and empty bootstrap, not psql-only. Fault-inject before/after FK/view changes; verify schema/data/history rollback and readiness rejection for missing view/constraint. Bind evidence to exact checksum.
2. Populate P-only, R-only linked/unlinked, exact/email pairs, old-ID namespace collisions, owner-only and legacy-assignee fixtures. Assert both old-ID sets, role/join/inviter/metadata, task pairs, and byte-identical capacity/leave/group/classification/commitment/plan data. TESTENV's zero configuration/group rows cannot exercise preservation or new triggers there.
3. Mounted API tests: owner create/read; link assigned placeholder then title edit/reload; NULL-role denial/self-grant attempt; legacy/new revoke without deletion; omitted vs NULL role; peer restrictions; group add/grant; invalid cross-project edges; account delete. Concurrent link/revoke/assignment needs project-lock serialization proof—row locks plus a transaction-local permission SELECT alone do not prove it.

No tests run here. MEMBERS rehearsal/build claims are producer evidence, not independently validated. UI/Gantt/Excel/clone, exhaustive mounted authorization coverage, production dependency/grant inventory, SQLx transaction fault behavior and release/rollback execution remain unreviewed. Final independent review required after fixes/tests; this bounded report must not be used as final approval.

Unresolved questions: no product decision needed; runtime proofs above remain outstanding.
