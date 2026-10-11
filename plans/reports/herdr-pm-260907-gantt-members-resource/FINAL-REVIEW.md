# FINAL-REVIEW — independent integration/security arbiter

Status: **DONE_WITH_CONCERNS**
Source verdict: **REJECT the frozen member/clone artifact below.**
Integration/release: **BLOCKED by confirmed defects; no release approval.**
Gantt: **NOT REVIEWED.** PM requested immediate finalization rather than waiting for its active writer.

## 1. Boundary and artifact identity

- Independent session; primary `AGENTS.md` and startup docs read in order, including deployment. Read active plan/acceptance/decisions and DESIGN, MEMBERS, CLONE, CLONE-SPEC, MIGRATION-PREVIEW, MEMBER-MIGRATION-TEST, MIGRATION-ARTIFACT, final API-TEST. Applied `ak-code-review`, PostgreSQL guidance, and `ak-test` for existing local checks.
- Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/members-20260907`.
- Base/HEAD: `704d5221b227a2a8491e54a236b8b980108e4c63`; 39 tracked changed files + 5 untracked files in scoped manifest.
- Start hashes: **2026-09-07T15:17:24.3680347+07:00**. End hashes: **2026-09-07T15:27:59.7422293+07:00**. **All 44 hashes match start/end**, including tests and canonical SQL. Manifest in §7.
- PM freeze received; API-TEST is **COMPLETE**, not RUNNING. Its reported backend-tree SHA-256 is `6e671915da1b94ffa242d35f7df7c8cb2c5e3d1d9bf2218416fc4427dd7e79d6`; that report-specific aggregate was not independently reconstructed. This review independently records exact per-file bytes.
- No product/test/config/plan/ledger edits. No DB, SSH, server, browser, commit, push, deployment, or nested agents. Only this report written. Findings are source-verified unless explicitly attributed to independent execution reports; no invented database reproduction.
- Initial authorization checkpoint published before ten-minute deadline. Review stopped immediately at PM instruction; no extension requested.

## 2. Confirmed blockers — hand to backend debugger first

Paths below are relative to the member worktree. These are unmet accepted contracts, not a request for app-wide redesign.

### FR-H1 — legacy member reads bypass authorization

**Evidence:** `backend/src/graphql/resolvers/project_member.rs:18-42,65-96`; `members/query/get_members.rs:9-34`; `members/query/get_member.rs:9-38`. These read account email/name/role by supplied project/member IDs without caller login or project-read guards. Both resolver families are mounted in `backend/src/graphql/schema.rs:23-37`. Both alternatives for duplicate `project_members`/`project_member` fields are unguarded, so duplicate dispatch order does not cure this.

**Concrete path:** outsider or unauthenticated GraphQLContext supplies a known project ID and requests its active member accounts. `graphql/handlers.rs:102-119` builds/injects context even when auth is absent; no whole-request authorization substitutes for these guards. NULL-role filtering in two implementations protects decoding, not caller permission. The retained `get_member.rs` also still lacks the NULL-role filter before non-null `MemberRole` decoding; its duplicate-field dispatch must be resolved/tested rather than assumed safe.

**Required:** guard both single/list implementations and access-only projection. Mounted anonymous, outsider, linked-no-access and authorized-owner queries; deny without leaking members. This remains within previously required H2/H3/legacy API compatibility.

### FR-H2 — legacy role mutation bypasses canonical protected-target controls

**Evidence:** `backend/src/graphql/resolvers/project_member.rs::update_project_member/remove_project_member`; `members/mutation/update.rs:19-22,45-57`; `members/mutation/bulk_update.rs`. These check caller's scheduling-write role and self identity, but do not reject owner/manager/leader/admin targets. Canonical `resource_members/mod.rs::set_project_member_access` does protect these targets.

**Concrete path:** leader calls legacy `update_project_member` to demote a manager peer to MEMBER, then legacy remove clears that member's role. Both duplicate update implementations allow the first step. Even if remove dispatch selects `members/mutation/remove.rs`, its current-role protection has already been bypassed by demotion. `ProjectMemberMutation::remove_project_member` itself has no protected-target test.

**Required:** one consistent accepted caller/target access policy across retained single/bulk/new access writes; owner/peer/self negative probes through actual mounted operations. New canonical-only tests are not sufficient. Preserve role-only revoke and canonical identity/configuration.

### FR-H3 — touched write paths do not implement promised revoke/write serialization

**Evidence:** `backend/src/graphql/resolvers/mod.rs:88-106`, `require_project_write_tx`, runs plain `SELECT EXISTS` with no authorization/project lock despite claiming revocation protection. Resource link/access locks only its **target member**; task update locks its **task**; legacy access mutations use a separate pool guard; `scheduling.rs::add_project_members_by_group` authorizes before beginning its transaction. Clone's hierarchy advisory lock is not shared with member/access revocation and is taken after its authorization check.

**Concrete missing invariant:** touched operation passes authorization; concurrent access change commits; previously authorized operation can still perform/commit its write. Target-row locks do not mutually exclude a change to the caller's different membership row. This is a static transaction-interleaving finding against DESIGN §5, **not a claim that this race was executed**. Final API-TEST explicitly says no concurrent link/revoke/assignment test.

**Bounded fix scope:** canonical member creation/link/access, retained single/bulk access mutations, touched task create/update/clone/assignment, and group access grant. Use a shared consistent transaction-lock order and recheck authorization after acquiring it. Prove revoke-versus-protected-write serialization and duplicate-link conflict with deterministic concurrency tests. No request to redesign every unrelated application resolver, add distributed locking, or introduce a generic security framework.

### FR-M1 — bulk removal cannot consume normal HTTP authentication context

**Evidence:** `backend/src/graphql/resolvers/members/mutation/bulk_remove.rs:14-18` asks for standalone `Claims`; normal `graphql/handlers.rs:118` injects `GraphQLContext` only. `schema.rs:69-75` injects PgPool/config/loaders, not Claims. Authenticated HTTP requests therefore fail before this operation's policy/query. Its privileged-target exclusion also omits admin/owner, and its caller membership-only predicate does not honor owner-with-NULL-role authority.

**Required:** consume normal GraphQLContext/shared policy, retain role-only revoke and project scoping. Positive real-context owner/manager bulk test and negative self/owner/privileged-peer tests. Do not make tests pass by injecting extra Claims absent from production requests.

### FR-H5 — owner-only project reads can panic; project listing omits owner authority

**Evidence:** `backend/src/graphql/resolvers/project.rs::project` uses an access-only count CTE, LEFT JOINs its result, then `project.get("member_count")` decodes mandatory `i64` (`types/project.rs:37`). `ProjectQuery::projects` requires `pm.user_id = $1 AND pm.role IS NOT NULL`, without the independent owner predicate.

**Concrete accepted migration case:** owner exists without prior access membership; migration creates canonical owner with role NULL, correctly inventing no grant. If the project has zero access rows, its count join is NULL, so constructing `Project` panics even when the selection asks only `project_id`. The owner-only project is also omitted from the projects list. Final API test's **new** project uses an inserted manager role and does not exercise this case.

**Required:** zero-safe member count, owner-or-access listing, and mounted read/list proof on synthesized-owner/zero-access fixtures. Do not “fix” by fabricating owner role grants in migration.

## 3. Other confirmed findings collected before stop

### FR-H4 — successful List assignment returns to stale source; Excel also retains old values

**Evidence:** `web/src/components/tasks/TaskListView.tsx:1205-1225` replaced Redux assignment dispatch with `updateAssignee()` but ignores the returned task and does not refresh/update Redux. Closing edit (`:1254`) triggers `:214-219`, restoring `initialTasks` from unchanged Redux (`ProjectDetailView.tsx:55-62,210`). Nested optimistic updates never apply because `updateSingleTaskInState` searches root IDs only (`:193-213`). Excel assignment save (`:1076-1090`) ignores the result and does not refetch `task_tree_rows`.

`useTaskFieldMutations.ts:466` emits `task-assignee-updated` without resource ID; exact repository search finds no listener. Apollo uses default `InMemoryCache` without a Task `task_id` key policy; it cannot repair the independent Redux/tree source automatically.

**Result:** DB write may succeed, but normal UI reverts as edit closes; Excel clears the successful staged edit and displays old source data. **Required:** propagate returned canonical assignment pair into actual root/descendant sources or refetch them; test normal/Excel root+child save, clear, and refresh. This is not a claim persisted SQL assignment fails.

### FR-M2 — existing invalid classification edges escape migration validation

**Evidence:** `backend/migrations/20260907000001_consolidate_project_members.sql`, function `validate_resource_classification`, adds a trigger for future classification writes. Its final existing-row validation block checks group/leave/commitment/capacity only, never `resource_member_classifications`. Preceding `20260901000300_create_resource_membership.sql` enforces FKs/no-self, not same-project/kind.

**Counterexample:** existing cross-project edge or MEMBER-as-classifier survives consolidation; creating a trigger does not validate existing rows. No assertion production contains such corruption. This is an unclosed M4 fail-closed contract, despite genuine valid-edge preservation and future-invalid-write proof.

**Required:** negative pre-migration fixture proving refusal/rollback and a controlled artifact decision if correction is needed. **Do not silently change frozen `6484...` SQL or patch SQLx history.** Any approved new source/artifact must be re-frozen and retested.

### FR-M3 — clone recovery does not refresh truthfully or consistently

**Evidence:** `TaskListView.tsx:1044-1063,1794-1805` omits `taskTreeRowsQ.error`; failed initial tree load can remain “Loading…” through `!data`. GraphQL CONFLICT/NOT_FOUND leaves stale tree/selection without required refresh. Network recovery swallows refresh rejection then says “task list refreshed” and allows retry. A confirmed successful clone followed by a non-network refresh failure is also presented as retryable clone failure.

**Risk:** stale selection/retry and duplicate trees after an already committed but unconfirmed result. **Required:** distinguish committed, unknown-commit and failed-refresh states; truthful error, confirmed refresh before retry, source refresh/reselection on conflict. Existing dialog tests mock parent `onSubmit`, so they do not exercise this integration code.

## 4. Evidence accepted — and what it does not prove

| Evidence | Result and limit |
|---|---|
| Canonical physical model | Full new SQL read: one `project_members` base; resource compatibility VIEW; stable dual handles; nullable link/access; task mirror backfill; resource FK retargeting. No saved-plan JSON rewrite found. Not unconditional migration approval: FR-M2 remains. |
| Prior H1–H5/M1–M4 | Role-only revoke, ordinary canonical inserts, link mirrors, qualified group trigger, account-unlink ordering, and readiness view/constraint checks present. Legacy auth/policy and zero-access reads still incomplete; existing-classification validation missing. Do not mark the whole prior finding set closed. |
| Assignment source | Shared normalizer implements omit/null/value and legacy resource-null+user compatibility; task update preserves omitted parent. DB trigger validates project/kind/mirror on task writes. Final mounted fixtures cover several positive/negative pairs, not every DESIGN table row/concurrent ordering. |
| API-TEST final | **29/29 contracts + 1/1 actual mounted PostgreSQL flow PASS**, reported against frozen backend. Inspected persisted exact 3 roots+9 children, fresh IDs, per-copy parent mapping, nested/child-source mapping, selected omission, cycle/moved rejection, second-insert rollback, canonical link/revoke/config/account-delete assertions. These are meaningful tests, not empty stubs. No legacy read/peer/bulk or member concurrency acceptance inferred. |
| Contract adjustment | 3→5 resource write-guard count is justified by two added operations and adds per-method guards; it does not remove tested guards. That source-level contract covers resource methods, not every legacy member entry point. |
| Clone copied fields | Source reviewed against copy/reset map; representative reset/preserve assertions exist. Exact entire field map was not independently rerun/exhaustively asserted: e.g. null description source is bound as NULL rather than spec's old empty-string default. Report as a compatibility edge needing reconciliation, not evidence of broad data loss. |
| Independent migration reports | MEMBER-MIGRATION-TEST first found historical CRLF checksum mismatch. MIGRATION-ARTIFACT **supersedes it for the operational LF snapshot**: actual populated upgrade + fresh bootstrap pass; identity/config/task/plan preservation and 13 rejected future-invalid writes; missing-view/constraint readiness probes. This reviewer made no database connections. |
| Historical migration packaging | All 14 deployed/stored SHA-384 values match operational LF bytes per MIGRATION-ARTIFACT. Base Git historical blobs are CRLF. Final integrator must commit actual LF blobs plus narrow SQL line-ending policy and verify archive bytes against all 14 report hashes; preserve new SQL `6484...`. No history patch/checksum bypass. Not yet reviewed as a final Git/archive artifact. |

### Independent local execution

- Existing clone helper, TaskCloneDialog, TaskExcelGrid suites: **3 suites, 34/34 tests PASS**, 44.811s, zero snapshots.
- Ran installed `web/jest.config.js` in memory; overridden default reporter because `jest-junit` is unavailable; disabled cache/coverage/watch; no config/test source edits. Initial PowerShell quoting attempt failed before test execution; corrected command passed.
- `git diff --check`: **PASS**, including final end check.
- No Rust/DB rerun here: forbidden DB/network boundary; retained independent final reports used instead.
- Full web type/lint/build and full cargo format/clippy/test were not run in this stopped review. Known **303 baseline web TypeScript errors** are not reclassified as introduced. Existing build type/lint skips do not substitute for those gates.

Reproduction command for the local focused run (PowerShell; no report files generated):

```powershell
# From members-20260907/web
$code = @'
(async () => {
  const config = await require('./jest.config.js')();
  config.reporters = ['default'];
  config.watchPlugins = [];
  config.cache = false;
  config.collectCoverage = false;
  const { results } = await require('jest').runCLI({
    config: JSON.stringify(config), runInBand: true, runTestsByPath: true,
    watch: false, watchAll: false, $0: 'jest',
    _: ['src/utils/__tests__/cloneTask.test.ts',
        'src/components/tasks/__tests__/TaskCloneDialog.test.tsx',
        'src/components/tasks/__tests__/TaskExcelGrid.test.tsx']
  }, [process.cwd()]);
  process.exitCode = results.success ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
'@
node -e $code
```

## 5. Exact unreviewed / incomplete scope at PM stop

1. **All final Gantt source and R1–R12 closure** in `gm-20260907`, including the 41-test regression gate, projection modes, lifecycle races, grid/matrix alignment and original Gantt acceptance. No Gantt source inspected. Only IN_PROGRESS authority-report header/checkpoint checked for readiness; no final authority handoff/freeze and no GANTT-REVIEW source pass. No raw GANTT-TEST logs read.
2. **Full final integration tree**, merged shared files, final LF Git blobs/`.gitattributes`, archive checksum verification, built backend/frontend artifact identity and reruns. The manifest below is member-worktree scope, not an integrated release manifest.
3. **Remaining member/API behavior**: exhaustive mounted legacy add/update/remove/bulk/group role matrix; every assignment tri-state combination; duplicate/ambiguous email/error-code semantics; member/link/access/task/group-grant concurrency. Source inspection identified blockers but did not reproduce those missing runtime cases.
4. **List/Excel/member browser and component integration**: actual parent→hook→Redux/tree→reload wiring, errors/staged preservation, empty project identity, all-depth filter/sort combinations, member link/access/config refresh. The TaskList diff and touched paths were reviewed, not every pre-existing line of its large component or all retained SchedulingConfigPanel forms. Existing three focused suites do not establish these flows.
5. **Full schema/contract and broad regression closure**: generated SDL and root contract file hashed, not completely independently audited; runner delta reviewed rather than its entire baseline implementation. Full format/clippy/tests/lint/types/build not completed by this arbiter.
6. **Operational deployment/rollback/readiness/browser**: no production activity or public verification; no same-schema rollback/restore rehearsal review beyond retained design/migration reports. Source acceptance and release operations remain distinct.

Bounded observations for the next owner, not new speculative redesign: empty List project ID is still derived from tasks rather than explicit project context; resource/member error extensions are not consistently the accepted stable codes; member position controls were removed but current Rust SDL lacks the purported position mutation, so no claim that working production position persistence regressed. `reorder_tasks` in the frozen member tree remains unguarded/no expected_order validation: known DESIGN integration dependency, not reviewed as final Gantt output.

## 6. Required next action

Assign independent backend debugger to **FR-H1/H2/H3/M1/H5** with the exact source hashes below and current accepted policy. Preserve passing clone/member contracts; extend actual mounted negative/positive/concurrency tests instead of weakening guards/assertions. FR-H4/M3 need the List/clone UI owner. FR-M2 needs explicit migration-artifact handling, not an unrecorded frozen-SQL edit.

After controlled fixes: new source/test manifests, applicable reruns, and separate independent re-review. Do not promote these rejected bytes because 29 contracts and one broad mounted test are green. Resume Gantt review only on its final handoff/freeze. No product scope removed; no unrequested reversible decision made.

## 7. Frozen scoped manifest

**Each SHA-256 below was identical at start and end.** This manifests the candidate source set; it is not a statement that every line/test in all 44 files completed review. Sorted manifest hash: `8A7023D45CC93A81D71AA4473D3759F6C6CAA73FDB40A64592407DA961F7547E` (UTF-8, uppercase SHA + two spaces + relative path, ordered as below, LF after each line).

```text
6484C09A8C602BD30A535EB532C000B8277FCCE7229251AB902CED5AF55E952A  backend/migrations/20260907000001_consolidate_project_members.sql
A245990F4A6876667ECB55124737EFE17604F8A1F8CB1A9D9FDDFDDB1D518E32  backend/schema.graphql
3F4EFFD89CEAFCC869F7F44D87EEBF37F61CDF19D443F66EBD130CFCDD8B7EEB  backend/src/db/models/resource_identity.rs
E27DBBCD04EC47E3072CE73D99F28A115945D8D42FFF0A349D7386FFA0D9113D  backend/src/domain/mod.rs
CAEB182AA49EEB657ABF2A1211E57902286FF22DC3FB51171FF8D6D5A0BC4821  backend/src/domain/project_member_identity.rs
E9E7EA27A507BBA321ABC90CF3051B9541DA3941C9F3EC57956CB67BA7C85F0F  backend/src/graphql/resolvers/members/mutation/add_by_email.rs
E99ACA4F9878B797897F19111410BA625412F41135BD5826E81A8F229C2D516F  backend/src/graphql/resolvers/members/mutation/bulk_remove.rs
779F9999E49339C9BF3C498ED9D771B8C12F68D5F10BDD11E75C19B156001059  backend/src/graphql/resolvers/members/mutation/bulk_update.rs
4191BEB9C28C2D70A4420A5610666B7B668F8E27DCD7C7AB8B8628CBCEE8B5DD  backend/src/graphql/resolvers/members/mutation/remove.rs
1B8D2E29C2A065FC9D1EAABCFC6AB3C302110FD8FA9F11641F16F5263347B559  backend/src/graphql/resolvers/members/mutation/update.rs
D35EEB43892DF9AA1348649C1DB64FD1CF99ACCE16562058373A4DFAC813FE63  backend/src/graphql/resolvers/members/query/get_members.rs
BA9DC6825A44B2B24B28FF70809C0ABA6B47D0E4B0C928C2110F590C9AA32CCC  backend/src/graphql/resolvers/members/query/my_role.rs
37B37509CACAFE6FE6E9D0F28C632322E34D81150899A5554324697C2E770802  backend/src/graphql/resolvers/mod.rs
AB9DC6D2D86BABD5C63F368F0548584BB199051FE36B97FB0217AE63F426128D  backend/src/graphql/resolvers/project.rs
207783A7A50F604D2C6A6BA164A647B06F6522DBD216053716E90D587772B50B  backend/src/graphql/resolvers/project_member.rs
6CCB8CE9B0A1258A093EA7A00351E5B6BC871E0696BE0925FFCC739C1E65613F  backend/src/graphql/resolvers/resource_members/mod.rs
068989CBB32DAB03BC862E4A3D142613012BAA579D0E78A0162A0D12ED24F657  backend/src/graphql/resolvers/scheduling.rs
A996BE8082D6CCC4EC635BF977737740E5A4D791BA02540A0BDE32F0CF4650F2  backend/src/graphql/resolvers/tasks/mod.rs
69147F7497416436693BBFD400B7B827D33AA83D326FED608760E6440D66BB49  backend/src/graphql/resolvers/tasks/mutation/clone.rs
6702A3A7AE39F267D786981BD1024CA0D38173D9967515CED767DA4DEDF24157  backend/src/graphql/resolvers/tasks/mutation/create.rs
221480E56580B7AE065A757967C7BAC1D27EB6BFDCEEDCFCC15BEC584BE55722  backend/src/graphql/resolvers/tasks/mutation/mod.rs
F7B2BE7BAC30DDE67FF033B9C152405B1B7F92F75AF70148AD02A293F7312B95  backend/src/graphql/resolvers/tasks/mutation/update.rs
9D8AB6896AB18D3A35CB91CC830EF34EEEB1380AA723764E90B915306E7870EB  backend/src/graphql/resolvers/tasks/query/mod.rs
EC0155038086A38C7E37236A809049C4B2DC21836F120009F8936DD1B3EB1F57  backend/src/graphql/resolvers/tasks/query/tasks.rs
992B2A0556EE159B5CD45BAD5A87A0C10519F8934AE9C93D40BA0FEEA0561328  backend/src/graphql/types/mod.rs
16B4C7E42D8BBB6F8A433F8B5FB16DC0D8DFCDC28ABA91C846B6C3C3F7927BEB  backend/src/graphql/types/task.rs
F3AB77D74F022B157E00530190962290F3CA02DEBE470898B141B88BC563DE00  backend/src/migration_runner.rs
20937B0E6795008A38324A6A3CB1F92DDD616EE56160500D0EADC95D91452462  backend/tests/contract/increment1_graphql.rs
182E41F0753A6E2CE41D7D739235051E2427C32078B138CD45428947ABFEC798  backend/tests/contract/main.rs
E4B965637BB4547C87D936A33B9D10AE6161F70FA635593A56719C7CE5681984  backend/tests/herdr_flow.rs
39A9CDE5DF8F3E2FC63D39EC38A464C8CE861F10081CF1050F1B24F18F7131EA  web/src/components/projects/MembersView.tsx
71E349098B5A96A61486C3A1767FC63B527B15EADA2226F6F1CE5C6636C156CC  web/src/components/projects/SchedulingConfigPanel.tsx
27BAAE2A8BB119C857B2C69D4A3A6F261CB76749F835D2312B3AD4021BF1919D  web/src/components/tasks/__tests__/TaskCloneDialog.test.tsx
BD21288ED61EE4EEFA3AFB3F60222FFD814D0F3A31188175039E09108C871967  web/src/components/tasks/__tests__/TaskExcelGrid.test.tsx
D559BA3179C22690F2E1DEA89785D5EAE4165F0C19F9682AC8D1E8F2B389DCDC  web/src/components/tasks/TaskCloneDialog.tsx
D73CA51382A1F2499975DC9D31F9818D7B703D4B70B14CFED5FB2DABB20A0C96  web/src/components/tasks/TaskExcelGrid.tsx
D61747ABF8878555A2357559875D4FEBE5ABAFFDBE2A5C8B9E84B69DF5014C35  web/src/components/tasks/TaskListView.tsx
4B07B2B37B84BB059D797E41ABF13B50EAD1D2FDD0D7059945F0F51BFBE7316B  web/src/graphql/mutations.ts
B7180D4A376731ADDEDA7433EE5CCA1F5A594A1D454F7F9087D077D8D53C13B3  web/src/graphql/mutations/tasks.ts
CC091A289CCA96401345ABA061285AE5F52BA5D3A7A62F3AF87EA8084E57C955  web/src/graphql/queries/tasks.ts
D3CA5CE5DCBCDE83A89A36A9336114CD78021F151879B91C424427EB75D38B1C  web/src/graphql/scheduling.ts
1F87365E34B708ED6FC5320C3512341B9556BC2C6C9DE8B20458FB679EF26029  web/src/hooks/useTaskFieldMutations.ts
079C237FC4C38DB885C5F3ACE6D5A7B2EFBB2B42AA8D518041BFFF5EEFB0EF52  web/src/utils/__tests__/cloneTask.test.ts
4E476AA169C576B2465DA1F5AEB4F00EF4D6CC16DBF0B2045098C9AFEC836498  web/src/utils/cloneTask.ts
```

Supplementary context SHA-256, measured at end only (except migrate CLI also matched the initial check):

```text
E91B215095F0AA83B07158D903CF66628AED50291D38C9914257CD230EAFAB9C  backend/src/graphql/resolvers/members/query/get_member.rs
59841F086298E13A992D0341843B15711366BC1D95737FC71CFD6429EFA9949F  backend/src/graphql/schema.rs
F24958BC5ED70BF7C0009596A2537BA3A70626CE402E6AE3C9EB53C915F7825E  backend/src/graphql/handlers.rs
81E728D719492AD790D60B64B71D153AB088861AE007799416BA757D2987A389  backend/src/graphql/types/project.rs
C247B40B43880A46C2C602E6EB9A3B91EAD5F39089FF4CC46F632CEC35385188  backend/src/graphql/resolvers/tasks/mutation/reorder.rs
A84A6F13E7BD2449C1687EDD2204F0218BACFA97BF6F789A989A28C766380A97  backend/src/domain/taxonomy.rs
FB2D30E61A9B3FA4A20B4229E998D4517BE5685431009644539FFAAC428DA353  backend/src/bin/migrate.rs
00C1EE49A590AD70B6F6DDD2DEF7F2B2B08D02563D1188CE04CCDA006987682D  web/src/components/projects/ProjectDetailView.tsx
FCD8BA406B3406B4FC2A5FA9478B9D969331FDB5AF9A79FF11791F7A03EA2D94  web/src/redux/features/tasksSlice.ts
06D63D3D39776A9F1AD9B1857D014BDE77A60B598F58F238459A658F0A4B4F67  web/src/lib/apollo-client.ts
C45BAFFC928CCCFDCA27208153DC564EBFFC43CE10FED046ACB5C6AB291FD3B1  web/jest.config.js
```

## Unresolved questions

No new product question. Operational/source dependency: PM must resolve FR-M2 without silently replacing the frozen migration artifact; backend/UI fixes and their new verification manifests remain outstanding. Final Gantt/integration/release review intentionally unfinished at PM stop.
