# BACKEND-FINAL-REVIEW

Status: **DONE_WITH_CONCERNS**  
Source verdict: **REJECT the exact frozen backend artifact below.**  
Release gate: **BLOCKED** — preserved-role reads panic; stable member error codes incomplete.  
Reviewer: independent `openai-codex/gpt-6-astra` session; no nested agents/self-approval.  
Finalized: **2026-09-07 16:51 Asia/Bangkok**. Initial concrete checkpoint published within ten minutes.

## 1. Decision

Named authority fixes are substantively verified, not merely accepted from producer logs. Independently ran the final mounted suite twice on **own** PostgreSQL DB, actual runner bootstrap/upgrade/two failed upgrades, additional assignment/concurrent-clone probes, and actual HTTP readiness faults.

**Do not release these bytes:** producer's raw `admin`/`viewer` concern is now eight independently reproduced resolver panics. A separate three-case test proves missing required `extensions.code`. Neither finding asks to change the accepted physical schema or rewrite stored roles.

| Gate | Disposition on these bytes | Independent evidence |
|---|---|---|
| FR-H1, legacy member read authorization | **Closed for authorization/null-role projection** | Both duplicate families and combined mount reject anonymous, outsider, linked-no-access with null data; owner positive. Shared implementations filter `role IS NOT NULL`. Preserved-role decoding separately fails BFR-H1. |
| FR-H2, target policy | **Closed** | Owner/manager/leader/admin ordinary-target positives; self/owner/privileged-peer negatives across canonical, legacy single/add/bulk; mixed batches roll back; demotion bypass denied. |
| FR-H3, revoke/write serialization | **Closed in assigned touched-write scope** | Project row lock precedes permission statement and hierarchy/member/task locks. Fifteen actual mounted writes observed waiting behind administrative revocation, then denied with unchanged fingerprints. Duplicate ID/email link: exactly one success, loser CONFLICT and unchanged. |
| FR-M1, bulk normal context | **Closed** | Uses GraphQLContext only. Owner-null-role and privileged caller positives; protected-target mixed-batch rollback. No standalone Claims injection. |
| FR-H5, owner-null-role/zero-count | **Closed for original defect** | Owner-only project read/list returns count 0 without fabricated grant or duplicate owner row. Minimal project read containing raw legacy role separately fails BFR-H1. |
| FR-M2, invalid existing classification | **Closed for final SQL `72f892…`** | Exact old/new diff is only eight added lines in existing-row validation. Own actual runner rejects cross-project and MEMBER classifier; complete old rows/history/schema restored by transaction rollback. |
| Reorder | **Accepted, scoped** | Full live same-project set, unique IDs/nonnegative unique ranks, expected-order mismatch CONFLICT/atomicity, legacy omitted shape, hierarchy preservation and authorization pass. |
| Assignment | **Accepted, scoped** | Existing mounted negatives plus independent 11-transition matrix: omit/set/matching pair/contradictory pair/unlinked/legacy-user/null clears. Parent unchanged throughout. |
| Clone/tree | **Accepted, scoped** | Original 3 roots + 9 children/fresh IDs/per-copy parent maps, nesting/selection/injected rollback/all-depth read guards and order pass. New observed-blocker move-child/delete-child/move-root cases reject with zero clone inserts. |
| Physical model/preservation | **Accepted, scoped** | One `project_members` base, compatibility VIEW; seven resource FKs retargeted, nullable role/user, role default absent, constraints/triggers present; original IDs/config/tasks/plans preserved. |
| Overall frozen source | **Rejected** | BFR-H1 high-severity compatibility blocker; BFR-M1 incomplete accepted error contract. Final assembled release manifest still requires independent matching/reverification. |

## 2. Confirmed findings

Paths relative to `members-20260907`.

### BFR-H1 — preserved legacy roles crash authorized reads (High; blocks source acceptance)

**Source:**
- `backend/src/graphql/types/project.rs:174-201`: SQLx-derived `MemberRole` has only manager/leader/member/guest. String adapter understands admin/viewer, but SQLx row decoding does not call it.
- `backend/src/graphql/resolvers/members/query/get_members.rs:40`, `get_member.rs:45`: `row.get("role")` directly decodes that enum.
- `backend/src/graphql/resolvers/project.rs:116,141`: eager member/current-role decoding, even for selection `{ project_id }`.
- `backend/src/graphql/resolvers/members/query/my_role.rs:42,48`: same direct decode, including debug print.
- Duplicate families delegate to these functions (`project_member.rs:18-30`; mounted `schema.rs:23-37`).

**Runnable reproduction:** own `source/tests/final_review.rs::preserved_legacy_role_read_compatibility` (SHA-256 below), normal mounted Query/Mutation + GraphQLContext, real migrated PostgreSQL. Creates synthetic owner/project and a linked member with raw role `admin`, then repeats with `viewer`. Each of these operations panics:

```graphql
query { project_members(project_id: "PROJECT") { role } }
query { project_member(project_id: "PROJECT", user_id: "MEMBER") { role } }
query { project(project_id: "PROJECT") { project_id } }
query { my_project_role(project_id: "PROJECT") }
```

First three run as authorized owner; last as that member. Captured independently through spawned resolver futures; all **8/8 PANIC**:

```text
ColumnDecode { index: "\"role\"", source: "invalid value \"admin\" for enum MemberRole" }
ColumnDecode { index: "\"role\"", source: "invalid value \"viewer\" for enum MemberRole" }
```

**Invariant:** preserve every old role and retain usable authorized project/member APIs. This is a pre-existing decoder defect left unresolved in the accepted compatibility scope, **not claimed newly introduced**: the enum file has no diff from base. Producer's green read test inserts raw admin only *after* its positive read assertions (`tests/support/authority_regressions.rs`). Its admin authorization checks therefore never proved admin-containing read compatibility.

**Required owner action:** make retained read decoding safely compatible with preserved raw roles using the existing compatibility policy; keep database role bytes unchanged. Exercise both duplicate mounts, project and own-role reads. Do not invent grants, rewrite enum values in migration, or hide rows to obtain a green result.

### BFR-M1 — accepted stable error codes absent (Medium)

**Source:** `backend/src/graphql/resolvers/resource_members/mod.rs:365-371,447-452` constructs plain GraphQL errors for unknown email and omitted access role; `resolvers/mod.rs:139-157` converts `AuthError::Forbidden` without attaching GraphQL extensions. The HTTP `ResponseError` mapping is not the GraphQL error path.

**Runtime:** own `stable_member_error_codes`, real mounted schema/context:

| Operation | Required DESIGN §5 code | Observed |
|---|---|---|
| Link to syntactically valid unknown email | NOT_FOUND | error returned; `extensions.code = None` |
| Omit `role` from explicit access mutation | BAD_USER_INPUT | error returned; `extensions.code = None` |
| Outsider legacy member list | FORBIDDEN | access correctly rejected; `extensions.code = None` |

No authorization bypass claimed. These responses cannot support the accepted stable machine-readable error handling. Preserve rejection and rollback behavior; attach the specified codes at existing error boundaries. Reorder/clone codes and duplicate-link CONFLICT positives do not establish the whole member contract.

## 3. Independent commands and results

Remote operational root, all paths below relative to it:

`/home/azuraith/task-scheduler/rehearsals/gm-20260907/final-review-verification`

Runtime DB: **only `gm_final_review_20260907`**, owned by `gm_tester`, shared TESTENV container loopback55435. Compile SQLx metadata: read-only `gm_rehearsal`. Password read from secured TESTENV file into environment memory; never printed. No production5434 connection.

```text
# In own source; own copied CARGO_TARGET_DIR; credential URLs nonprinting
cargo test --locked --offline --test contract --test herdr_flow -- --test-threads=1 --nocapture
  First independent run: 29/29 contracts + 1/1 mounted flow PASS; exit 0
  Final repeat:           29/29 contracts + 1/1 mounted flow PASS; exit 0

cargo test --locked --offline --test final_review -- --test-threads=1 --nocapture
  assignment_tristate_matrix_parent_preserved       PASS (11 transitions)
  concurrent_clone_tree_change_rolls_back           PASS (3 observed-blocker cases)
  http_readiness_missing_view_and_constraint        PASS
  preserved_legacy_role_read_compatibility          FAIL (8 resolver panics)
  stable_member_error_codes                        FAIL (3 missing codes)
  Final: 3 passed; 2 failed; 0 ignored; exit 101

cargo build --locked --offline --bin migrate
  PASS; actual owned migrate executable used below

<own>/target/debug/migrate  # own fresh DB
  BootstrappedFresh { applied: 15 }; Current { version: 20260907000001 }; exit 0
<own>/target/debug/migrate  # own restored populated old schema
  ForwardOnly { applied: 1 }; Current { version: 20260907000001 }; exit 0
<own>/target/debug/migrate  # each own invalid-existing-edge fixture
  expected integrity refusal; exit 1; full rollback PASS for both cases

git diff --check -- backend
  PASS; existing Windows LF-conversion warnings, no whitespace failure
```

Final original-suite runtime: contract 0.15s first run, mounted 2.53s first run; final additional suite 0.96s. Compiler warnings retained; no claim warning-free or clippy/full-suite pass.

### Honest mounted/source identity boundary

The frozen `herdr_flow.rs` positively hard-codes the **producer's** DB name. Its binary cannot safely run unchanged on the reviewer-owned DB. Copied retained source and target into own root (no shared binary inodes/hardlinks); changed **only the one DB-name literal in own copied test**, from `gm_auth_verify_20260907` to `gm_final_review_20260907`. All original assertions/product/migration bytes unchanged. Original migration Python probe is also producer-owned/hard-coded; inspected it but **did not execute it against producer DBs**. Own migration probe is separately guarded.

Own added tests are under `source/tests/final_review.rs`, not product tree. Final hash:
`44c8e4f571466b2ac9242fc73a8eff14678d63d112071f7a5189b94d83595bb3`.

Claims are only inside `GraphQLContext.auth`, exactly the data shape built by `graphql/handlers.rs:102-119`; no extra standalone Claims/schema authentication data. Mounted tests do **not** verify bearer/Firebase/JWT transport. No fake pass from unset TEST_DATABASE_URL: test requires it and verifies actual database name.

### Actual HTTP readiness, not a CLI inference

Own isolated Actix HTTP app mounted **production `api::routes::health_ready`** at `/health/ready`, with the same `web::Data<Arc<PgPool>>` shape and real migration probe. Verified unused deterministic bind **127.0.0.1:58073**; no 8081 binding. This is the real handler over loopback HTTP, not a replacement decision function; it is not the full Firebase-dependent `main` application.

```text
Current schema:      HTTP 200 {"status":"ready","database":"up","migrations":"current"}
Dropped VIEW:        HTTP 503 {"status":"not_ready","database":"up","migrations":"partial-schema"}
Dropped constraint:  HTTP 503 {"status":"not_ready","database":"up","migrations":"partial-schema"}
Each exact restore:  HTTP 200
Own server: stopped; port verified unused afterward
```

Fresh backup before each fault. Constraint was `project_members_access_requires_linked_member`; exact definitions captured/restored. Real health proof repeated on final probe run.

### Concurrency evidence limits

Original suite uses recursive `pg_blocking_pids` observation, not sleep-only success. Shared project gate is acquired before a separate READ COMMITTED permission SELECT. Administrative revocation fixture deliberately clears manager access under that gate; privileged-peer revoke through the API is forbidden, so it is **not claimed a mounted peer-revoke operation**. All protected writes themselves use actual mounted resolvers. New clone probes similarly mutate synthetic tree state in a transaction holding the production project gate, observe clone wait, then release; source revalidation denies each changed tree.

Observer deadlines: original 10s; independent clone wait/completion 5s each; outer cargo process budget 480s. Actual DB deadlock count after final run: **0**. No unbounded/global absence-of-deadlocks claim; unrelated writers/direct SQL are not certified.

## 4. Migration/data-integrity disposition

Exact new SQL: **24,028 LF bytes**, SHA-256 `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7`.
Retained old SQL: **23,508 LF bytes**, SHA-256 `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a`.
Independent unified diff: `evidence/migration-independent.diff`; only the controlled FR-M2 existing-edge check, no other SQL delta:

```diff
+ SELECT 1 FROM resource_member_classifications c
+ LEFT JOIN project_members target ON target.resource_member_id = c.resource_member_id
+ LEFT JOIN project_members classifier ON classifier.resource_member_id = c.classified_by_resource_member_id
+ WHERE target.member_id IS NULL OR classifier.member_id IS NULL
+    OR target.project_id <> classifier.project_id
+    OR target.member_kind <> 'MEMBER'
+    OR classifier.member_kind NOT IN ('COMPANY', 'GROUP')
+ ) OR EXISTS (
```

Read-only original populated dump restored into **own newly created DB**, never reusing an old migrated DB to qualify the new hash. Before every destructive reset: verify own marker, exact DB+owner, TESTENV labels/root, exclusive loopback55435; create pg_dump backup. Used actual custom runner without baseline, history edits, dependency changes, or checksum bypass.

### Catalog and history

- `project_members=r`, `resource_members=v`; no second physical member authority.
- Resource ID/display name NOT NULL; role/user nullable; role has **no default**.
- Old access primary IDs and scheduling IDs retained. Same-project/user uniqueness and access-requires-linked-MEMBER CHECK present.
- All seven historical resource FKs reference canonical resource ID, including both classification endpoints; task FK ON DELETE RESTRICT, user FK ON DELETE SET NULL.
- Canonical task/group/classification/capacity/leave/commitment/account-unlink/identity-immutability triggers present. Same-project assignment is enforced by trigger (not claimed a new composite task FK).
- `fresh-catalog.txt` records names/definitions. Readiness fingerprint checks view/base kinds, nullability and three named constraints; it is **not** an exhaustive trigger/FK-definition tamper detector.
- All **14** raw base Git migration blobs contain zero CR and match retained LF files and actual unchanged SQLx SHA-384 records. INTEGRATE's correction confirmed; older claim that Git blobs themselves were CRLF is false. Windows checkout/default archive conversion is the issue. Final packaging still requires `git -c core.autocrlf=false archive` and narrow LF policy.
- New stored SHA-384 independently matched exact final SQL. All history checks recorded in `history-sha384.txt`.

### Populated preservation

All original access IDs/metadata, original resource IDs/project/display/kind, task stable fields excluding two intentionally normalized mirrors, complete plans and every resource-config table compared before/after. Exact equality; four deterministic assignment-normalization fixtures and 3 access/6 resource fixture handles additionally asserted.

```text
access                         d12b09f2007fbfd37b1e488d4cbd1d6c
resources                      c5ad5507a0554b2a5d003b2a33ed8844
tasks excluding two mirrors    5e3214b0035d463fd63429026ec9e0ab
plans full rows                 382d8daa7d8038243d602a5b0e1d0309
member_capacity_settings       a59c893c0a017b6c155be5d2bc567a9e
member_capacity_overrides      bdcc09aa7df56c408614d3ec00968ee3
member_days_off                0dc192128714c3e8b79767fc12169103
resource_groups                e930b729a99de77dd4933d82e13d1b35
resource_group_members         edb75e363ab353c38fd2e04f3a188707
resource_member_classifications ccfd5fa18c13f3d1d4f83d01ef76377f
recurring_commitments          577700a0153920c5ada663d543fd33ee
```

Own plan digest orders by complete JSON row, unlike producer's plan_id ordering; before/after equality is direct, not an unexplained cross-report digest match. No saved JSON rewrite.

Both negative fixtures verified raw member/resource rows, classification/config/task/plan digests, relation kinds, full history identical before/after failure. History remains 14, canonical resource column absent, canonical assignment trigger absent: new DDL rolled back. The bad-edge state is retained in own backups; final DB was subsequently reset/backed up for the final mounted repeat.

## 5. Artifact identity and freeze

Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/members-20260907`.  
Branch/base: `codex/member-consolidation-20260907`, `704d5221b227a2a8491e54a236b8b980108e4c63`.

Full scoped raw-byte manifest: **225 files**, backend Rust/SQL/SDL/Python/Cargo.toml; all unchanged from **16:29:40.778** to **16:50:47.916** Asia/Bangkok. This includes directly related context beyond changed files; hashing is not claimed complete line/coverage review of every baseline module.

- `evidence/local-before-complete.json`, intermediate `local-after.json`, final `local-final-after.json`, `source-full.sha256`.
- Full manifest SHA-256: `a27a8d286e8c3ec51399a6e59be9451b05b06b6f248dd96729cd5024d5fcdfc7`.
- Changed/new 34-file manifest SHA-256: `e9d7655d25493415e8f4cc0bba2009129f828285c4cd3f3b2cc25c49c633b889`.
- All producer final **23 raw local hashes matched** retained tested source. All 225 files LF-equivalent to retained source; unchanged Windows baseline CRLF is distinguished from runtime LF bytes. No silent product normalization.
- Own product/source copy also matched, allowing only disclosed test DB-name adaptation. Retained authority source unchanged on end comparison.

```text
Cargo.lock       9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc
Cargo.toml       6ef60df99d4df3bcf2c2355ae83374d1b4086296f5e77b3e373aa5cfa7e2b247
migration_runner f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00
bin/migrate.rs   fb2d30e61a9b3fa4a20b4229e998d4517be5685431009644539ffaac428da353
migrate binary   a95829cde7352297450cfe61d2b77b6307707dcfbed1ecb3c0937ea61a6f6237
main debug bin   01d0a131ba67b3524bf1c6dee2df12f3c871933d3b293b7b8557d401260557c8
```

Source worktree does not supply the lock; own operational copy uses exactly the retained tested/release-foundation lock above. No resolution/upgrade. Main debug binary is identified, **not claimed deployed or launched**. HTTP probe compiles/uses the real library handler.

### Exact changed/new source manifest

Each hash identical before/after; SHA-256, paths relative to source root:

```text
72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7  backend/migrations/20260907000001_consolidate_project_members.sql
8ef6b6fc17b878e5894bff917561d5020fe4269f79939546a64b9b904cf5fe95  backend/schema.graphql
3f4effd89ceafcc869f7f44d87eebf37f61cdf19d443f66ebd130cfcdd8b7eeb  backend/src/db/models/resource_identity.rs
e27dbbcd04ec47e3072ce73d99f28a115945d8d42fff0a349d7386ffa0d9113d  backend/src/domain/mod.rs
caeb182aa49eeb657abf2a1211e57902286ff22dc3fb51171ff8d6d5a0bc4821  backend/src/domain/project_member_identity.rs
d0deef8eca627e4cd653fe90c3c7dd61b6d791b7c4ed83ba7f8eef56ba6ee1c7  backend/src/graphql/resolvers/members/mutation/add_by_email.rs
b16e08560f10c1eab920452a3b61c0303c4b0893ec076b1159b9a5e2dba5e802  backend/src/graphql/resolvers/members/mutation/bulk_remove.rs
18c15430d78b7e27584364e1f58c5e0254295c045848ea440cb5af86cb2b205a  backend/src/graphql/resolvers/members/mutation/bulk_update.rs
ca99a5f07b673fa5892d3cf82e72a9f27d91d71b7723dae8f50ac40546c75d60  backend/src/graphql/resolvers/members/mutation/remove.rs
5ba050774772d9b94d27182485b0f8cee093ab171b79f379468ee69207e973cd  backend/src/graphql/resolvers/members/mutation/update.rs
365b5197014bb7829037196c92f3653880a6c76ae7e1c553e565c7d3f808cb14  backend/src/graphql/resolvers/members/query/get_member.rs
50572c26f0d03042f298e08d48f6dc78a9986611acd8caa6c0bd235525d3b727  backend/src/graphql/resolvers/members/query/get_members.rs
ba9dc6825a44b2b24b28ff70809c0aba6b47d0e4b0c928c2110f590c9aa32ccc  backend/src/graphql/resolvers/members/query/my_role.rs
3fa64d3100d196129b51c8d7f58a6e944fd339e619bacb28f5600acfe77807b2  backend/src/graphql/resolvers/mod.rs
3290f8099ac1ea605fd7f73c53dba38d9ec3f1ebc7c5a164868613f8631de2a8  backend/src/graphql/resolvers/project.rs
51ca74951e7964aebf45a6b33084aab22928e11fd9220aeb6c8d669aa6f441d7  backend/src/graphql/resolvers/project_member.rs
207ce87bb3d043cfb01c45839a77d6033b9926bf480694eda1fe47eabd67c08b  backend/src/graphql/resolvers/resource_members/mod.rs
50148effe834f906f53c62b82cb391b7e595aad9c8ada6d6917d46497b2abecc  backend/src/graphql/resolvers/scheduling.rs
a996be8082d6ccc4ec635bf977737740e5a4d791ba02540a0bde32f0cf4650f2  backend/src/graphql/resolvers/tasks/mod.rs
341acfba0c6556a73241be3f8159d6759bdbb0e44309eb92b7fa98094f9cc071  backend/src/graphql/resolvers/tasks/mutation/clone.rs
bbc954f9532be242200d8f3371bb5f63e1b7a7654fc0037eac1d2b1aba8e472d  backend/src/graphql/resolvers/tasks/mutation/create.rs
221480e56580b7ae065a757967c7bac1d27eb6bfdceedcfcc15bec584be55722  backend/src/graphql/resolvers/tasks/mutation/mod.rs
3be59ea8e632c66ad18d71d37e4aacf563c77fe8d22a020c351d8a92134d906d  backend/src/graphql/resolvers/tasks/mutation/reorder.rs
f0432e2c71cae83c928b255cf3f196ad6a6add0c23192111c4a492e8f3e970e2  backend/src/graphql/resolvers/tasks/mutation/update.rs
9d8ab6896ab18d3a35cb91cc830ef34eeeb1380aa723764e90b915306e7870eb  backend/src/graphql/resolvers/tasks/query/mod.rs
ec0155038086a38c7e37236a809049c4b2dc21836f120009f8936dd1b3eb1f57  backend/src/graphql/resolvers/tasks/query/tasks.rs
992b2a0556ee159b5cd45bad5a87a0c10519f8934ae9c93d40ba0feea0561328  backend/src/graphql/types/mod.rs
960aee3377a7aee9ab5ef23a61a2752434bb7c2a1f7ae33d1cdbc0f75ae9339a  backend/src/graphql/types/task.rs
f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00  backend/src/migration_runner.rs
20937b0e6795008a38324a6a3cb1f92ddd616ee56160500d0eadc95d91452462  backend/tests/contract/increment1_graphql.rs
f94713e4ba5fc4ab341c1d5fe60fe14ad966e826af736bad6adf3202c0135147  backend/tests/contract/main.rs
1bd78b453721c8a054936aa3b74209d496b376934d5fd0f3411936ce4ce8eaa1  backend/tests/herdr_flow.rs
66cd942055d9c4c49dc5978a8574973e9b18d7c89bdfcbbf4495cc82e6b72cd8  backend/tests/support/authority-migration-probe.py
430713308e46c6f68f35cf5f577b0def24cbed0d40d9595900daff7303370006  backend/tests/support/authority_regressions.rs
```

## 6. Evidence retained / cleanup

Own root only:
- `source/`, independently copied `target/`, `OWNERSHIP`.
- `source/tests/final_review.rs`, `run-mounted.py`, `run-extra*.py`, `run-final-repeat.py`, `migration-own.py`; hashes in `evidence/probe-hashes.json`.
- `evidence/mounted.*`, `repeat-mounted.*`, `extra.*`, `extra2.*`, `final-extra.*`: genuine passing and failing runs; `.rc` files retained.
- `evidence/own-migrate-build.*`, `own-runner-{fresh,upgrade}.*`, `own-bad-{cross-project,member-classifier}.*`, `migration-own.*`, `migration-own-complete.txt`.
- `evidence/own-upgrade-{before,after}.txt`, `*-own-{before,after}.txt`, `own-upgrade-assertions.txt`, `fresh-catalog.txt`, `history-sha384.txt`, source/binary manifests, independent SQL diff.
- Secured `backups/*.dump`, including empty, pre-reset, pre-migration, pre-HTTP, populated, invalid-edge and final-bad-edge snapshots. Retain for release-owner handoff; no personal data downloaded.

Final 16:50:47 source/evidence check: all 225 local, retained and operational source files still matched (disclosed test guard excepted). Sixteen backups plus `evidence/evidence-final.sha256` retained. At cleanup check: owned test/migration jobs exited, no owned server, loopback58073 unused, DB deadlocks 0. Own DB retained in final mounted/probe state (including synthetic legacy-role repro); original invalid-upgrade state retained in backups. **Do not drop shared container or other owners' DBs/roots.** Later cleanup must recheck marker, labels, exact own DB/owner and port. Retained `authority-verification`, `artifact-verification`, earlier DBs/builds and production untouched.

Only primary-tree write: this required report. No product, frozen SQL/history/config/SDL, web/Gantt, plan/ledger edits; no browser, prod service, commit/push/deploy or nested agents. Own contract test rewrites only own copied SDL and regenerated bytes match frozen source.

## 7. Failures and review limits

- First transport attempts failed before remote execution (PowerShell quoting; Windows argument limit). Stdin transport succeeded. Initial source list omitted Python and treated retained manifest's already-prefixed paths as backend-relative; comparison stopped before DB creation. Corrected to complete 225-file list and verified exact23. No bypass of a failed hash.
- First extra-suite fixture reused a unique username: two tests failed during seed, before relevant product execution. Corrected **own fixture** to per-user unique names; kept initial logs. Final runs expose actual role panics/error-code defects. No test weakened or failure hidden.
- Read-hook timeouts on three context files retried successfully; no skill/product modifications.
- Primary AGENTS/startup docs, plan/acceptance/decision ledger, DESIGN, FINAL-REVIEW, BACKEND-AUTHORITY-FIX final, API-TEST, MIGRATION-ARTIFACT, INTEGRATE and TESTENV read. Required code-review, test and PostgreSQL guidance applied. Root README/local rules absent; available global development rules read. Older generic topology docs not treated as deployment truth.
- Source review bounded to changed backend identity/auth/project/task/reorder/clone/migration seams, mounted schema/normal HTTP context, and direct types/helpers. No broad unrelated app rescout. This does not certify unrelated legacy task readers/writers, all scheduling config writers, direct administrative SQL, or arbitrary external integrations.
- No full cargo fmt/clippy/all-test gate, release optimized build, actual Firebase/JWT-authenticated HTTP request, browser/prod flow, UI/Gantt review, frontend type/build or final assembled release review. No new claim about the 13 old standalone future-invalid SQL fixtures beyond inspected producer evidence; own mounted DB and new migration-negative probes executed independently.
- Readiness tested for the requested view/constraint failures, not arbitrary trigger/FK removal. No proof of exhaustive migration-conflict combinations, load throughput, or every SQL interleaving.

## Required next gate / unresolved questions

Backend owner: fix **BFR-H1** and **BFR-M1** without changing stored roles or the accepted schema; retain all original passing tests and the independently failing cases; re-freeze/review exact new source hashes. Integrator must later match final assembled manifest, LF archive and exact lock/artifacts and rerun applicable gates. No production approval from this report.

Unresolved product questions: **none**. Remaining blockers are implementation/verification, not schema-choice decisions.
