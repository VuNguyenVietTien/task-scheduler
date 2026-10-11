# BACKEND-AUTHORITY-FIX

Status: **DONE_WITH_CONCERNS** — 2026-09-07 16:17 Asia/Bangkok.
Named fixes implemented and focused PostgreSQL gates passed. **Not integration/release approval**; independent review remains required. Authorized five-minute extension used only to flush this report and compare final hashes; no new implementation scope.

## Dispositions

| Finding | Disposition / real evidence |
|---|---|
| FR-H1 | Both duplicate legacy single/list families delegate to the same authenticated, project-read-guarded implementations. Access projection excludes NULL roles. Mounted combined schema AND each individual duplicate family: anonymous, outsider, linked-no-access denied with null data; owner positive passed. |
| FR-H2 | One `require_access_target_tx` policy reused by canonical and retained single/bulk/add/group access writes. Self, owner, current manager/leader/admin targets protected. Demotion-then-removal bypass rejected. Mixed protected batches roll back prior attempted ordinary-member changes. Owner/manager/leader/admin ordinary-target positives passed. Role-only revoke preserved. |
| FR-H3 | `require_project_write_tx`: project row lock FIRST, separate subsequent permission SELECT gets fresh READ COMMITTED snapshot after waiting. Touched member create/link/access, retained single/bulk/add, task create/update/clone/assignment/reorder and group grants use it before target locks. Hierarchy lock follows project lock. Fifteen real mounted writes queued behind administrative revocation; PostgreSQL blocking observed, post-wait authorization denied, exact member/task fingerprints unchanged. |
| FR-M1 | Bulk removal consumes normal GraphQLContext only; no standalone Claims injection. Owner with NULL access role and manager/leader/admin bulk positives, self/owner/privileged-target mixed-batch negatives passed. |
| FR-H5 | Project list uses owner OR non-null access predicate, without duplicate owner rows. Count COALESCE handles zero active members. Mounted owner-null-role, zero-access-member project read/list passed without manufacturing grants. |
| FR-M2 | Exceptionally unfrozen new SQL adds existing classification endpoint/project/kind validation only. Actual executable custom-runner populated upgrade and fresh bootstrap passed. Existing cross-project edge and MEMBER-as-classifier both rejected, full rollback/history/data preservation proved. Old SQL retained. |
| Accepted reorder integration | Added optional `expected_order`; current order is `priority_order, task_id`. Full live same-project unique ID set, unique nonnegative ranks required before writes. Stale expected order returns CONFLICT, no partial updates. Old omitted-expected shape remains serialized. Mounted unauth/no-access, incomplete/foreign/duplicate IDs, negative/duplicate ranks, stale multi-row order, owner/manager positives and hierarchy preservation passed. Generated SDL includes optional field; existing contract strengthened. |

No product-policy redesign. Link does not grant access. Stable member/resource handles, unlinked assignment, task mirrors/config, role-only revoke and original atomic 3-parent/9-child clone semantics retained.

## Actual validation

Final operational source, fresh owned PostgreSQL reset, normal production context shape:

```text
cargo test --locked --offline --test contract --test herdr_flow -- --test-threads=1 --nocapture
  contract:   29 passed; 0 failed; 0 ignored; 0 filtered out; 0.14s
  herdr_flow:  1 passed; 0 failed; 0 ignored; 0 filtered out; 2.69s
  exit: 0

rustfmt --edition 2021 --check --config skip_children=true <20 owned Rust paths>
  PASS, exit 0

git diff --check
  PASS (Windows line-ending warnings retained, no whitespace failures)

cargo build --locked --offline --bin migrate
  PASS, exit 0
```

`DATABASE_URL` compile metadata: read-only `gm_rehearsal`; runtime `TEST_DATABASE_URL`: only `gm_auth_verify_20260907`. Values constructed from protected TESTENV password in memory, never echoed. Cargo.toml unmodified; retained tested lock matches integrator hash below. No local cargo available.

Test uses actual `Query`/`Mutation` mounts and `Request.data(GraphQLContext)` as HTTP handler does. Claims exist only inside `GraphQLContext.auth`, not as extra schema/request data. This is in-process mounted resolver execution against real PostgreSQL, **not HTTP transport/JWT verification**. Duplicate families additionally mounted independently to remove dispatch-order ambiguity.

Concurrency is deterministic: hold real production project gate, spawn resolver requests, query recursive `pg_blocking_pids` until actual wait chain observed, then release. Duplicate ID/email links: exactly one success, loser CONFLICT, both IDs retained and loser unlinked/no-role. Revoke tests cover create member, ID link, email link, canonical access, single update/remove, ID/email add, bulk update/remove, task create/update-assignment/clone/reorder and group grant. Administrative revoke fixture writes role NULL while holding shared production gate; it is deliberately **not** a mounted privileged-peer revoke, which accepted policy forbids. Protected write itself always mounted. No timing-only sleep proof and no mocks.

## Migration qualification

Original SQL: 23,508 LF bytes, SHA256 `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a`.
New SQL: 24,028 LF bytes, SHA256 **`72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7`**.
Raw old bytes and exact unified diff: `evidence/old-6484.sql`, `evidence/canonical-migration.diff`.

Actual custom runner, no baseline/history/checksum bypass:

```text
Populated gm_auth_upgrade_20260907:
  migration outcome: ForwardOnly { applied: 1 }
  migration state now: Current { version: 20260907000001 } (current)
Fresh gm_auth_bad_edge_20260907, before its owned negative-fixture resets:
  migration outcome: BootstrappedFresh { applied: 15 }
  migration state now: Current { version: 20260907000001 } (current)
Existing cross-project classification: runner exit 1, expected integrity refusal; rollback PASS
Existing MEMBER classifier: runner exit 1, expected integrity refusal; rollback PASS
Final failed-upgrade catalog:
  history|14|20260906000002
  canonical_columns_after_rollback|0
  canonical_trigger_after_rollback|0
```

Fixture reused read-only secured populated original-backup restore from `artifact-verification/backups/gm_members_verify_populated.dump`; no old rehearsal DB changed. This contains original production backup plus deterministic prior migration fixtures. Fresh and pre-reset/pre-migration backups taken before every destructive stage. Original 3 fixture access IDs/6 resource IDs/4 normalized assignments verified with prior assertions; **all original production+fixture** access IDs/metadata, resource IDs/project/display/kind, task stable fields, full plans and every resource-config table checked, not just fixture counts. Task assignment mirrors intentionally normalize; no saved JSON rewrite.

Before = after digests:

```text
access                        d12b09f2007fbfd37b1e488d4cbd1d6c
tasks (excluding two mirrors)  5e3214b0035d463fd63429026ec9e0ab
plans (full rows)              a5c553a03e2da07944634571c057096e
member_capacity_settings      a59c893c0a017b6c155be5d2bc567a9e
member_capacity_overrides     bdcc09aa7df56c408614d3ec00968ee3
member_days_off               0dc192128714c3e8b79767fc12169103
resource_groups               e930b729a99de77dd4933d82e13d1b35
resource_group_members        edb75e363ab353c38fd2e04f3a188707
resource_classifications      ccfd5fa18c13f3d1d4f83d01ef76377f
recurring_commitments         577700a0153920c5ada663d543fd33ee
resources                     c5ad5507a0554b2a5d003b2a33ed8844
```

Reused fresh trigger/classification/account-delete fixtures: valid writes plus 13 invalid writes passed. Bad-existing-edge probes compare before/after data/config/plan fingerprints, raw role/resource rows, classification rows, relation kinds and full SQLx history; final catalog confirms new DDL/trigger rolled back.

Historical migrations never edited locally. Operational copy CRLF→LF normalized and each file compared byte-for-byte with prior verified deployed-LF snapshot. **PM correction supersedes earlier MIGRATION-ARTIFACT Git-CRLF attribution:** base Git blobs are LF; Windows conversion caused CRLF. Integrator owns `git -c core.autocrlf=false archive` and scoped attributes. No historical semantic/history changes.

## Durable evidence / cleanup

All remote paths below under:
`/home/azuraith/task-scheduler/rehearsals/gm-20260907/authority-verification`

- `OWNERSHIP`, `source/`, independent copied `target/`, `source.tar`, `final-input.tar`, `final-source.tar` retained for final owner. No shared build hardlinks/mutation.
- `evidence/final-test.{out,err,rc}`: exact final test results and every concurrency marker.
- `evidence/first-test.{out,err,rc}`, `second-test.{out,err,rc}`: failed and recovered runs preserved.
- `evidence/rustfmt-check.out`, `formatted-files.txt`, `final-source.sha256`.
- `evidence/migrate-build.{out,err}`, `runner-upgrade.{out,err,rc}`, `runner-fresh-bootstrap.{out,err,rc}`.
- `evidence/upgrade-before.txt`, `upgrade-after.txt`, `populated-assertions.out`, `bootstrap-*-tests.sql.out`.
- `evidence/runner-bad-{cross-project,member-classifier}.{out,err,rc}`, `{cross-project,member-classifier}-{before,after}.txt`, `rollback-catalog-final.txt`.
- `authority-migration-probe.py`, `resume-negatives.py`, `evidence/migration-probe.{out,err}`, `negative-resume.{out,err}` record exact original/resumed execution. Runnable source probe retained at `backend/tests/support/authority-migration-probe.py`.
- `backups/*.dump`, `evidence/backups.sha256`: empty, restored, pretest/reset/negative backups retained securely.
- `evidence/owned-process-cleanup.txt`: owned test/migration processes exited; no owned server started. No active processes left.

Retain owned DBs `gm_auth_verify_20260907` (tested mounted state), `gm_auth_upgrade_20260907` (successful preserved upgrade), `gm_auth_bad_edge_20260907` (old schema/14-history expected failed-upgrade fixture). PM/final release owner owns later cleanup after rechecking labels/root/owner/loopback55435. Do not touch any prior rehearsal DB or shared container/root.

Verified before destructive setup: TESTENV owner/root labels and exclusive `127.0.0.1:55435`; all three DB names and own root absent. Production5434/backend/tunnel, old member/artifact builds and DBs untouched. No web/Gantt, config/dependency edits, nested agents, commit/push/deploy/browser or PM ledger edits. Report is sole primary-tree edit.

## Checkpoints / failed attempts

15:58 checkpoint saved implemented groups and started first actual test. 16:05 checkpoint saved 29/29 contracts and mounted read/policy/owner/reorder group PASS, with whole-test failure honestly retained. Failure was direct-blocker-only observer timeout; PostgreSQL queue has transitive blockers. Recursive actual lock graph fixed observer; second run 29+1 PASS. Final run after conflict-code, group-target, multi-row reorder tests and formatting also 29+1 PASS.

Several SSH banner timeouts recovered through non-stdin script transport. Initial PowerShell quoting failure changed nothing. One parallel privacy-hook timeout retried successfully. Migration negative harness initially hit PostgreSQL `text || char` operator ambiguity in its catalog digest, before invoking negative runner; explicit `relkind::text` fixed harness, both negative fixtures recreated/backed up/rerun successfully. No product tests weakened, no failure concealed.

## Final source identity

Base `704d5221b227a2a8491e54a236b8b980108e4c63`, branch `codex/member-consolidation-20260907`. Formatted tested files and generated SDL copied back to owned local paths only. At 16:19 Asia/Bangkok, all **23 local source SHA256 values exactly matched** downloaded `evidence/final-source.sha256`; report write confirmed successful.

```text
Cargo.lock        9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc
Cargo.toml        6ef60df99d4df3bcf2c2355ae83374d1b4086296f5e77b3e373aa5cfa7e2b247
migration_runner  f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00
bin/migrate.rs    fb2d30e61a9b3fa4a20b4229e998d4517be5685431009644539ffaac428da353
migrate binary    a95829cde7352297450cfe61d2b77b6307707dcfbed1ecb3c0937ea61a6f6237
manifest SHA256   1c014d15a5627f1385c340352c65cd21158ea3f20798961b65f4f2d464444f43
```

Exact `evidence/final-source.sha256` (SHA256; paths relative to backend):

```text
72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7 migrations/20260907000001_consolidate_project_members.sql
8ef6b6fc17b878e5894bff917561d5020fe4269f79939546a64b9b904cf5fe95 schema.graphql
d0deef8eca627e4cd653fe90c3c7dd61b6d791b7c4ed83ba7f8eef56ba6ee1c7 src/graphql/resolvers/members/mutation/add_by_email.rs
b16e08560f10c1eab920452a3b61c0303c4b0893ec076b1159b9a5e2dba5e802 src/graphql/resolvers/members/mutation/bulk_remove.rs
18c15430d78b7e27584364e1f58c5e0254295c045848ea440cb5af86cb2b205a src/graphql/resolvers/members/mutation/bulk_update.rs
ca99a5f07b673fa5892d3cf82e72a9f27d91d71b7723dae8f50ac40546c75d60 src/graphql/resolvers/members/mutation/remove.rs
5ba050774772d9b94d27182485b0f8cee093ab171b79f379468ee69207e973cd src/graphql/resolvers/members/mutation/update.rs
365b5197014bb7829037196c92f3653880a6c76ae7e1c553e565c7d3f808cb14 src/graphql/resolvers/members/query/get_member.rs
50572c26f0d03042f298e08d48f6dc78a9986611acd8caa6c0bd235525d3b727 src/graphql/resolvers/members/query/get_members.rs
3fa64d3100d196129b51c8d7f58a6e944fd339e619bacb28f5600acfe77807b2 src/graphql/resolvers/mod.rs
3290f8099ac1ea605fd7f73c53dba38d9ec3f1ebc7c5a164868613f8631de2a8 src/graphql/resolvers/project.rs
51ca74951e7964aebf45a6b33084aab22928e11fd9220aeb6c8d669aa6f441d7 src/graphql/resolvers/project_member.rs
207ce87bb3d043cfb01c45839a77d6033b9926bf480694eda1fe47eabd67c08b src/graphql/resolvers/resource_members/mod.rs
50148effe834f906f53c62b82cb391b7e595aad9c8ada6d6917d46497b2abecc src/graphql/resolvers/scheduling.rs
341acfba0c6556a73241be3f8159d6759bdbb0e44309eb92b7fa98094f9cc071 src/graphql/resolvers/tasks/mutation/clone.rs
bbc954f9532be242200d8f3371bb5f63e1b7a7654fc0037eac1d2b1aba8e472d src/graphql/resolvers/tasks/mutation/create.rs
3be59ea8e632c66ad18d71d37e4aacf563c77fe8d22a020c351d8a92134d906d src/graphql/resolvers/tasks/mutation/reorder.rs
f0432e2c71cae83c928b255cf3f196ad6a6add0c23192111c4a492e8f3e970e2 src/graphql/resolvers/tasks/mutation/update.rs
960aee3377a7aee9ab5ef23a61a2752434bb7c2a1f7ae33d1cdbc0f75ae9339a src/graphql/types/task.rs
f94713e4ba5fc4ab341c1d5fe60fe14ad966e826af736bad6adf3202c0135147 tests/contract/main.rs
1bd78b453721c8a054936aa3b74209d496b376934d5fd0f3411936ce4ce8eaa1 tests/herdr_flow.rs
66cd942055d9c4c49dc5978a8574973e9b18d7c89bdfcbbf4495cc82e6b72cd8 tests/support/authority-migration-probe.py
430713308e46c6f68f35cf5f577b0def24cbed0d40d9595900daff7303370006 tests/support/authority_regressions.rs
```

## Concerns / explicit limits

- Full cargo fmt/clippy/full-test and HTTP auth/browser/integrated Gantt gates not run. Existing broad compiler warnings retained; targeted compile/tests/format passed, not warning-free certification.
- Pre-existing legacy `MemberRole` SQLx enum decoding still lacks raw `admin`/`viewer` variants although database retains them and existing string adapters map them. This session proves admin **authorization/protected-target policy**, not owner member-list decoding containing those raw legacy roles. That direct read-compatibility edge needs independent disposition; no silent enum/grant policy redesign attempted at deadline. Do not infer exhaustive preserved-role read compatibility from green owner-zero-access tests.
- Reorder frontend integration must send the complete live set and compare `expected_order` in `priority_order, task_id` order; optional shape preserves older clients only when their existing payload supplies that accepted full set. No Gantt writer source changed here.
- Locks deliberately cover accepted touched paths, not unrelated app-wide writers or direct ad-hoc SQL. Administrative/direct SQL must use the same project gate to participate.

Unresolved questions: no product choice requested. Independent reviewer must disposition legacy raw-role read decoding and final integration before release approval.
