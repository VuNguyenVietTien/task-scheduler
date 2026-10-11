# BACKEND-COMPATIBILITY-FIX

Status: **DONE** — 2026-09-07 17:12 Asia/Bangkok.  
Scope: **BFR-H1 and BFR-M1 implemented and verified. Independent review still required; not release approval.**

## Findings and changes

**BFR-H1:** SQLx-derived `MemberRole` decoding bypassed the existing string compatibility adapter. Preserved `admin`/`viewer` rows therefore panicked in list, single-member, eager project-member/current-role and own-role reads. The debug print in own-role also decoded unsafely.

Changed the four read implementations to select `role::text AS role` and use one fallible `MemberRole::from_database_row` helper. It uses `try_get` followed by the existing strict `FromStr`, **not** the defaulting `From<String>`. Existing mapping remains admin→manager, viewer→guest; four current roles unchanged. Unknown, NULL or missing role columns return errors, never a fabricated grant. Removed the unsafe own-role debug decode. Existing NULL-access filtering, owner access/count behavior and duplicate-family delegation remain unchanged. No legacy non-null row hidden, no stored role rewritten, no enum variants or grant policy added.

**BFR-M1:** Attached GraphQL `extensions.code` at the actual existing boundaries, not HTTP `ResponseError`: unknown email→NOT_FOUND; omitted/invalid explicit role→BAD_USER_INPUT; shared project authorization→FORBIDDEN/UNAUTHENTICATED. Ambiguous normalized email retains rejection with CONFLICT; existing duplicate-link CONFLICT behavior retained. Authorization predicates, permission ordering, project lock/recheck, protected-target rules and mutation/rollback SQL unchanged.

Seven product files changed, all within ownership:
- `backend/src/graphql/types/project.rs`
- `backend/src/graphql/resolvers/{project.rs,mod.rs,resource_members/mod.rs}`
- `backend/src/graphql/resolvers/members/query/{get_members.rs,get_member.rs,my_role.rs}`

Permanent behavior-named tests: `backend/tests/member_read_compatibility.rs` (three tests). No audit-labelled permanent suite or mocked DB.

## Actual verification

All Cargo commands used `--locked --offline`, normal mounted Query/Mutation with **Claims only inside GraphQLContext**, real PostgreSQL. No standalone Claims injection or skipped-unset-DB pass.

| Run | Contracts | Expanded mounted flow | Retained independent suite | Permanent suite |
|---|---:|---:|---:|---:|
| Before fix | 29/29 | 1/1 | **3 pass, 2 fail** | not yet added |
| Final | 29/29 | 1/1 | **5/5** | **3/3** |
| Final repeat | 29/29 | 1/1 | **5/5** | **3/3** |

Commands, separately and sequentially:

```text
cargo test --locked --offline --test contract --test herdr_flow -- --test-threads=1 --nocapture
cargo test --locked --offline --test final_review -- --test-threads=1 --nocapture
cargo test --locked --offline --test member_read_compatibility -- --test-threads=1 --nocapture
```

Baseline independently reproduced **8/8 resolver panics** and all **three missing codes**. Final/repeat: eight reads OK; exact three required codes present. First tested-group checkpoint sent after baseline; passing-fix checkpoint sent before final identity/cleanup check.

Permanent assertions cover all six retained/current role labels, both duplicate query mounts plus combined mount, list/single exact roles and identities, nested project members/count/current role, own role, canonical raw-role output, NULL-role owner and unchanged full member-row fingerprints. Real SQL rows exercise unknown, empty, NULL and missing role columns without schema/enum alterations. Negative tests cover anonymous/outsider/linked-no-access duplicate reads, unknown-email authorization precedence, omitted/invalid role and unchanged rows after rejection.

Retained passing contracts include protected-target mixed-batch rollback, normal-context bulk behavior, owner-zero-count, duplicate ID/email link (one winner; CONFLICT loser unchanged), reorder/hierarchy, **15 observed PostgreSQL revoke/write waits with zero writes**, original clone tree/rollback assertions, **11 assignment transitions**, and **three concurrent clone changes** (move child/delete child/move root; observed blocking, rejection, zero inserted clones).

Original retained HTTP probe also passed: actual production readiness handler over owned loopback58073 returned current=200, missing view/constraint=503 partial-schema, restored=200. Backups before faults; handler stopped. This is not full Firebase/JWT HTTP application verification.

`rustfmt --edition 2021 --check --config skip_children=true` on eight owned Rust files: PASS. `git diff --check -- backend`: PASS; existing Windows line-ending warnings. Existing compiler warnings retained, not warning-free certification.

## Isolation and evidence

Own remote root:
`/home/azuraith/task-scheduler/rehearsals/gm-20260907/compatibility-verification`

Only runtime DB: **gm_compat_verify_20260907**, owner gm_tester. Root/DB confirmed absent before creation; OWNERSHIP marker created before use. Verified TESTENV labels/root/data mount and exclusive **127.0.0.1:55435** on `pm-gm-rehearsal-20260907`. Credentials read into memory, never echoed. `DATABASE_URL` used read-only compile metadata on gm_rehearsal; `TEST_DATABASE_URL` named only own DB. Verified identity/labels/port and took own backup before destructive test resets. Seven secured dumps retained, including empty, pre-run and final tested state.

Source/build copied independently from final-review-verification; no shared hardlinks/mutation. Original independent test preserved verbatim in `evidence/original-final_review.rs`, SHA256 **44c8e4f571466b2ac9242fc73a8eff14678d63d112071f7a5189b94d83595bb3**. Own operational copies change only DB-name guards/DB command arguments and HTTP backup destination to owned resources; all assertions preserved. Retargeted probe SHA256: `75bfb5b9ca02986d3eea05dc301880b5168f1dd2c6cdbce594d417282d5fdd90`. Primary existing test guards unchanged.

Raw paths under own root:
- `source/`, `target/`, `OWNERSHIP`, `backups/`
- `evidence/{baseline,final,repeat}-{mounted,retained}.{out,err,rc}`
- `evidence/{final,repeat}-compatibility.{out,err,rc}`
- `evidence/source-final.sha256`, `local-current.json`, `changed-source.json`, `historical-git.json`, `final-summary.json`, `cleanup.txt`, `evidence-final.sha256`
- `run-verification.py`, `stage-source.py`, `finalize-evidence.py`

Final cleanup: owned test/build jobs exited; HTTP listener stopped; port58073 unused; own DB deadlocks=0. DB/source/build/evidence retained for reviewer. No production5434/backend/tunnel access, browser, nested agents, commit/push/deploy, web/Gantt or PM authority changes.

## Final identity and unchanged SQL

**Canonical and all historical migration SQL bytes unchanged. Migration runner unchanged. No DB-history/checksum edits.** Read-query text projections are the only SQL changes in this fix. No full migration requalification repeated; previously qualified migration evidence remains applicable. Normal mounted-suite bootstrap still ran on own disposable DB.

- Canonical SQL: `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7`
- Runner: `f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00`
- Exact retained lock: `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc`
- SDL unchanged: `8ef6b6fc17b878e5894bff917561d5020fe4269f79939546a64b9b904cf5fe95`
- Full operational source manifest SHA256: **c77f1f49f93c540acca427cd064d9a46b22e9210c7b05f463d587f96ef1f1350**.
- Adjacent `BACKEND-COMPATIBILITY-FIX.source-manifest.json`: 226 scoped files, raw/local and LF hashes; SHA256 **f02b3de14835af41d7fb2f04be3c0234746d767905d011a03446dbeaadfaef8e**.

All eight changed files raw-byte match tested source. Other files LF-equivalent; 14 historical runtime files independently match raw base704d5221 Git LF blobs. No lock/manifest/dependency/config changes. Operational manifest additionally records lock and retained test.

Startup authorities, active plan/acceptance/decisions, full final review, authority-fix report and DESIGN read. Root README/local development rules absent; global rules used. One initial SSH quoting attempt failed before execution; a final download batch timed out after successful verification, required result logs recovered. No test assertions weakened.

Limits: no full cargo suite/clippy, optimized release build or release approval. Final assembled optimized artifact gate belongs to later owner; independent backend review is next. Unresolved product questions: **none**.
