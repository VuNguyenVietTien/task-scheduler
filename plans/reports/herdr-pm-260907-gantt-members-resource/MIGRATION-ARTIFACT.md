# MIGRATION-ARTIFACT — LF migration artifact verification

Task: `MIGRATION-ARTIFACT` · 2026-09-07 Asia/Bangkok  
Status: **DONE_WITH_CONCERNS**  
Operational verdict: **PASS**  
Packaging verdict: **final integration still must commit LF historical SQL blobs**.

## Result

A separate operational runner snapshot with LF-only migration files passed both required real paths with stock SQLx checksum enforcement unchanged:

```text
Populated upgrade:
migration outcome: ForwardOnly { applied: 1 }
migration state now: Current { version: 20260907000001 } (current)

Fresh bootstrap:
migration outcome: BootstrappedFresh { applied: 15 }
migration state now: Current { version: 20260907000001 } (current)
```

The populated DB retained old access member IDs, old resource IDs, roles, stable task bytes, resource configuration and saved plans. Expected task assignment normalization completed for all four fixture tasks. Exact prior trigger fixtures passed, including 13/13 negative writes rejected. Readiness detected both a missing compatibility view and missing canonical constraint as `PartialSchema`; restore returned `Current`.

Checkpoint after the first actual upgrade was written to this report at 2026-09-07 14:54 Asia/Bangkok.

## Boundaries and isolation

- Read-only source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/members-20260907/backend/{migrations,src/migration_runner.rs,src/bin/migrate.rs}`.
- Build source came only from the tester-frozen `member-verification/build-source`; no unfinished clone/API source used.
- Written remotely only under `/home/azuraith/task-scheduler/rehearsals/gm-20260907/artifact-verification`.
- New DBs, proven absent before creation and owned by `gm_tester`:
  - `gm_members_upgrade_lf_20260907`
  - `gm_members_bootstrap_lf_20260907`
- Every mutation guarded container labels `pm.rehearsal.owner=TESTENV`, expected rehearsal root, binding `127.0.0.1:55435`, and exact DB owner.
- Password read from the secured TESTENV file into process memory; never printed.
- `gm_members_verify_20260907` stayed old-schema with 14 successful history rows. Original three member-verification DBs, artifacts, source and cache stayed unchanged.
- API verifier source/build/DB and Gantt worktree untouched.
- No connection to production port `5434`; no service, release, tunnel, deploy, browser, Git commit or push operation.

## Frozen source and build

| Artifact | SHA-256 |
|---|---|
| `src/migration_runner.rs` | `f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00` |
| `src/bin/migrate.rs` | `fb2d30e61a9b3fa4a20b4229e998d4517be5685431009644539ffaac428da353` |
| original new SQL | `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a` |
| LF operational new SQL | `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a` |
| built `migrate` binary | `f121ed47489e44a77f96a7098b1c839b4a0dcd81df6bff0c370d6ee87ce36ea1` |
| populated clone backup | `b2173feca825f78479be88dc18b0645fa135537b603c2f1e30f725ffa570edb7` |
| empty bootstrap backup | `9aa84dceea2daaab6c22fed4367fe036ce4abd02ba8e9192cd0f1390ae14014c` |

End hashes of all three frozen source artifacts equal start/report hashes.

### New SQL line-ending fact

The frozen/current new SQL was already LF: `23,508` bytes, `0` CR bytes. Normalization was therefore a no-op; original and normalized SHA-256 are identical. This contradicts the prompt's expectation that the new file itself would differ by CRLF→LF, but preserves its exact semantic and byte content. Evidence: `evidence/new-sql-line-ending-proof.txt`.

## Historical checksums

All 14 LF-normalized historical files are byte-identical to deployed release `20260906T0645` and their SHA-384 values exactly equal untouched `_sqlx_migrations.checksum` bytes:

| Version | deployed/stored/LF SHA-384 |
|---|---|
| 20230705000001 | `d29352e3a179e0cfd192cb1675cd810faff57dc688d55121e84a3ad440a3a111c9ad3efcb968c7cea32f7eeedfcf62e8` |
| 20240616000001 | `ed4f4682a66fe0072b1d6ba1d6fb9c44fbd677ccdbfca58036f122ad5b4b8fb539b8b0c7b6d79d74940a37dc442eb62b` |
| 20250319000000 | `bf5bde0370b5ee9f90137742755cf791c19e193f87c23f5e721e29f3af4bb144d60f0f733aeef0ad8747de4629b8ff59` |
| 20250408000000 | `6227b5dffff8793398776aa3231b377cc3e9d2e9084842c8c08f41be606c5525349adddc703838ec37c3b0bba0ee0d4a` |
| 20250501000000 | `c9b71ae77c0a112562265683c25248bbf229a2202bb46aef7da8a516376bf9f01b1ccd62782cfc081dced0001f0aeaec` |
| 20260325000000 | `77bca6214624d62869050f1122fe0d90ec3b3157c536308add8f02552231a7d6296cb540f3a8ca4aed159eabe345a6a0` |
| 20260328000001 | `8a2664ff5f52a55e8337def87cad5761961408b08769d3bbd2cbe6ba75f43dd5c198c04cee1211ba2456f325cd5c06ee` |
| 20260901000100 | `94ad372b623d3318d9af3fd952538ac56a45e3ae4085057f6e0e93152df72a658ba7978e323ed00915fbc9a5b475d1dd` |
| 20260901000200 | `f1a05054a918758201b0a5b6b9d5c618fa1833c844dd2a92d9c5845a4e079ec96402e55346a694acdc2b4d44416eb241` |
| 20260901000300 | `a74348f30008a8b0ec704340d2195dab96940d302453c148ae186578f837e8667711c981913eb357381586038bd1cc46` |
| 20260905000001 | `ac498d734971ea883e60e064e014c8f1385258f9d0697c69fda48df2bf0bb5a47eb5cd7565173e79248d5436c2362ddd` |
| 20260905000002 | `33323e62ea506e58d8fbc9375c5a9fbd595ed4035fd6c37fab4627d9bf02e535196752334869170610884f40db0ffe16` |
| 20260906000001 | `06689582ff44a29ff9e2438e18fd66a0735f549d3490f6dade01a87b51a1231f7afac52f38ac3ff09db5ac999bf16c29` |
| 20260906000002 | `310d49ea93d9554db24ee9d3de6ec74997edcaaf7ef66b600ecc3944f31ef6ebefcf1d0ea5097cb817fbe4e2d9fee949` |

Important packaging concern: current commit `704d5221` Git blobs are CRLF for all 14 historical files. Their LF-normalized content is byte-identical to deployed/stored bytes, but raw current Git blobs are not. Evidence preserves both comparisons; no claim conceals this mismatch.

## Populated upgrade

Source was cloned by `pg_dump -Fc --no-owner --no-privileges` and `pg_restore --exit-on-error`; source was never modified.

Before runner:

```text
gm_members_upgrade_lf_20260907|gm_tester|5432|history=14|old_members=3|old_resources=6|fixture_tasks=4
```

After runner:

```text
history|15|20260907000001|true
relations|project_members=r|resource_members=v
fixture_members|10|role_nonnull=3|role_null=7
old_ids|member=3/3|resource=6/6
tasks_normalized|4/4
required_constraints|3/3
```

Pre/post preservation digests were exact:

| Scope | Before = after digest |
|---|---|
| Original access IDs + user/role/project | `7d0559cab78d9660df2aa712224d59dd` |
| Original resource IDs + project/display/kind | `86176f84ca1e26368abceb33fcb39456` |
| Fixture task stable bytes, excluding the two intentionally normalized assignment columns | `470ac6a692642d95ddec129c26f649a3` |
| Capacity/override/leave/group/classification/commitment configuration | `d33f06bd11b1acce75531be22ee4a4fc` |
| Full fixture plan rows and `plan_data` | `af3717bb1003e893c3f0463e9a0979e7` |

An initial deliberately over-strict comparison is retained, not hidden. It differed because its broad `member_id` pattern selected three additional post-consolidation canonical rows whose member IDs derive from old resource IDs; its full resource projection also included linkage metadata changed by required email-pair reconciliation. The corrected preservation query explicitly scopes the three original access IDs and six original resource IDs, while separately asserting four normalized task assignments. Final diff is empty.

## Fresh bootstrap and negative checks

Fresh runner result: 15 successful migrations, latest `20260907000001`, `Current`.

Catalog:

```text
project_members relkind r
resource_members relkind v
display_name/resource_member_id nullable NO
role/user_id nullable YES
required canonical constraints 3/3
```

Reused exact prior SQL fixture files byte-for-byte; source/copy SHA-256:

- trigger: `9b98326231af11ada2bb59bf3d083b7a6d0c587c7685638dd20484ff4e094a5a`
- classification: `bb2c1caaba58d2079d967e78c8ea653fd45cf12e56e207ad9f4ea0e8e1de58d3`
- self-consistency: `7954e3ab7b65878f5edd87bb06c537d514e825c71a5fee6caf2e382dd2cd08d2`

All three `psql -v ON_ERROR_STOP=1` runs exited `0`, stderr empty. Valid group/leave/commitment/classification/capacity writes passed; 13/13 invalid writes were rejected; account deletion preserved the canonical resource and cleared only link/role/account mirror as asserted. Runner remained `Current` afterward.

## Readiness fault checks

Each destructive probe had a fresh owned backup and label/port/owner guard. The DB was recreated/restored from that backup after each fault.

| Probe | Actual runner result |
|---|---|
| Drop `resource_members` compatibility view | `PartialSchema (partial-schema)` |
| Drop `project_members_access_requires_linked_member` | `PartialSchema (partial-schema)` |
| Restore exact backed-up schema | `Current { version: 20260907000001 } (current)` |

No migration history repair, manual baseline, checksum suppression or integrity bypass was used.

## Exact command classes

Credential-bearing URLs were in memory and are redacted here:

```text
git archive --format=tar HEAD backend/migrations
tr -d '\r' < git-blob.sql | cmp - LF-runner.sql
cmp deployed-release.sql LF-runner.sql
sha384sum LF-runner.sql
SELECT version, encode(checksum,'hex') FROM _sqlx_migrations ORDER BY version;

pg_dump -Fc --no-owner --no-privileges ... gm_members_verify_20260907
createdb -O gm_tester gm_members_upgrade_lf_20260907
pg_restore --exit-on-error --no-owner --no-privileges ...
CARGO_TARGET_DIR=<owned> DATABASE_URL=[redacted]/gm_rehearsal cargo build --locked --bin migrate
DATABASE_URL=[redacted]/gm_members_upgrade_lf_20260907 <owned>/debug/migrate
DATABASE_URL=[redacted]/gm_members_bootstrap_lf_20260907 <owned>/debug/migrate
psql -v ON_ERROR_STOP=1 -f <reused-trigger-fixture.sql>
```

`cargo build --locked --bin migrate` exited `0`; diagnostics are retained in `cargo-build.err` (warnings, not failure).

## Durable packaging recommendation

Final integrator should:

1. Add/confirm `.gitattributes`: `backend/migrations/*.sql text eol=lf`.
2. Renormalize and commit actual LF bytes for all migration blobs; semantic text must remain unchanged.
3. Verify raw committed blobs, preferably from `git archive`, against the 14 SHA-384 values above.
4. Verify final new SQL SHA-256 equals `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a`.
5. Build release artifacts from that verified Git archive, not a Windows checkout whose conversion behavior is implicit.

Until step 2, a build directly from raw current Git blobs can reproduce `VersionMismatch` despite this operational LF rehearsal passing.

## Failed-attempt evidence retained

- Original `member-verification` failure artifacts untouched.
- Empty `git-byte-comparison.txt` records the fail-fast raw Git-vs-LF comparison; detailed CRLF and normalized comparisons retained separately.
- Over-strict populated digest diffs retained and explained above.
- One preflight quoting error and one missing remote Cargo PATH attempt caused no DB/source mutation; successful corrected runs retained.
- `mempalace wake-up` was unavailable (`rc=127`), as in the prior tester session; unrelated to migration evidence.

## Cleanup and retained review assets

Owned running processes: `0`.

Retained for final review:

- `/home/azuraith/task-scheduler/rehearsals/gm-20260907/artifact-verification`
- `gm_members_upgrade_lf_20260907`
- `gm_members_bootstrap_lf_20260907`

Cleanup owner must revalidate TESTENV labels, port and DB owner, then remove only these two DBs and `artifact-verification`. Do not remove or mutate `member-verification`, its three DBs, `gm_rehearsal`, shared container, production services or production backups.

## Unresolved questions

None. Known integration action is explicit: commit and verify LF Git blobs before packaging.
