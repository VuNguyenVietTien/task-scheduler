# BACKEND-CLOSURE-REVIEW

Status: **DONE**  
Verdict: **PASS scoped source — accept BFR-H1/BFR-M1 closure; freeze the identified backend source for release integration. Not production approval.**  
Independent reviewer/tester, fresh session; assigned route `openai-codex/gpt-6-astra max`; no nested agents. Finalized **2026-09-07 17:32 Asia/Bangkok**. Confirmed identity/isolation/source checkpoint flushed by 17:24, within eight minutes.

## Findings and acceptance

**No confirmed defects in this closure scope.** Seven product files, permanent test, exact compatibility-only diff, mounted query delegation, normal request context, direct role/error callers and retained independent probe inspected. Prior SQL/migration/permission/reorder/clone qualification remains accepted; no source evidence invalidates it.

| Gate | Independently confirmed |
|---|---|
| **BFR-H1 CLOSED** | Raw `admin`→`manager`, `viewer`→`guest`; four current labels unchanged. Both `MemberQuery` and `ProjectMemberQuery`, plus combined mount, return exact roles/identities without panic or hiding non-null legacy rows. Eager project members/current-role decoding, minimal project selection and own-role reads pass. Canonical output retains raw role; complete member-row fingerprints unchanged. Owner with NULL role remains authorized without fabricated role/count. |
| Decoder failure behavior | `types/project.rs:190` uses `try_get::<String>` and strict `FromStr`, not defaulting `From<String>`. Real SQL rows with unknown/empty/NULL/missing role columns produce errors. Five production decode sites use it; duplicate query families delegate. Remaining single/add mutation enum decoding returns the explicitly validated newly written role, not an untouched legacy label. |
| **BFR-M1 CLOSED** | Unknown email returns exact `NOT_FOUND`; omitted/invalid explicit access role returns `BAD_USER_INPUT`; denied shared member access returns `FORBIDDEN`; anonymous requests return `UNAUTHENTICATED`. Unknown-email request as outsider fails authorization before account lookup; anonymous fails login. Rejections preserve complete member rows. |
| Authorization preserved | Compatibility-only diff changes error construction, not permission SQL, protected-target policy, project lock/recheck or mutation SQL. Target protection still precedes access-role validation. Both duplicate reads deny outsider/linked-no-access/anonymous; normal-context bulk, protected mixed-batch rollback, owner/manager/leader/admin positives and duplicate-link CONFLICT pass. |
| Retained write contracts | **11 assignment transitions**, parent preserved; **3 concurrent clone changes** observed blocking then rejected, zero inserted clones; **15 revoke/write waits** observed through PostgreSQL blocking, subsequent authorization denial and unchanged fingerprints. Reorder/full-set/stale-order/hierarchy and original clone selection/rollback assertions pass. |

References relative to worktree: `backend/src/graphql/resolvers/members/query/{get_members,get_member,my_role}.rs`; `resolvers/project.rs:92–146`; `resolvers/mod.rs:19–180`; `resolvers/resource_members/mod.rs:330–467`. Shared guards still gate their existing callers; no broad unrelated API certification implied.

## Independent commands/results

Executed through **`ssh -o BatchMode=yes u-cf`**, cwd `<owned-root>/source`, independent copied target directory. `DATABASE_URL` used read-only SQLx compile metadata on `gm_rehearsal`; `TEST_DATABASE_URL` named only reviewer DB. Both URLs constructed in memory; never printed. Exact retained dependency lock; no resolution/upgrades.

```text
cargo test --locked --offline --test contract --test herdr_flow -- --test-threads=1 --nocapture
  exit 0: 29/29 contracts + 1/1 expanded mounted flow; 0 failed/ignored
cargo test --locked --offline --test final_review -- --test-threads=1 --nocapture
  exit 0: 5/5 retained independent tests; 0 failed/ignored
cargo test --locked --offline --test member_read_compatibility -- --test-threads=1 --nocapture
  exit 0: 3/3 permanent tests; 0 failed/ignored
rustfmt --edition 2021 --check --config skip_children=true <eight owned Rust paths>
  exit 0
git diff --check -- backend
  exit 0; existing Windows line-ending warnings
```

Original probe retained at SHA-256 **44c8e4f571466b2ac9242fc73a8eff14678d63d112071f7a5189b94d83595bb3**. Previously reported 3-pass/2-fail probe now independently **5-pass**, including all eight previously panicking reads and all three exact missing-code cases. No original assertion removed, weakened or skipped. Own operational probe hash: `ec4f7db83cece52a361750c2ebf0218203cadc4b80dc374513ac26c0ce11632b`.

Only test adaptations: explicit positive DB-name guards/pg_dump DB argument and HTTP backup destination. Permanent test therefore differs operationally only in its ownership guard. Product bytes unchanged. Claims supplied **only inside GraphQLContext**, as in normal mounted HTTP handler; no standalone Claims injection.

To retain all five original tests verbatim, its small HTTP case also ran: real production readiness handler over owned loopback58073, current/restored=200, missing view/constraint=503 partial-schema. Backup before each fault. No additional migration audit: only the existing mounted suite's normal fresh bootstrap; no repeated populated migration rehearsal.

## Source identity / freeze

Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/members-20260907`  
Branch/base: `codex/member-consolidation-20260907`, `704d5221b227a2a8491e54a236b8b980108e4c63`.

- **226 local scoped files** match compatibility manifest raw hashes before/after. Remote retained and independently tested copies match all 226 LF hashes, with only disclosed test guards normalized for comparison.
- All **eight changed files** match producer-tested raw bytes before safety retargeting; seven product files remain raw-identical through execution. Exact delta from previous final-review artifact is those seven files plus the new permanent test—nothing else.
- Own **228-file operational manifest** includes retained probe and lock; before/after byte-identical. SHA-256: **d5512fbc98e5cb4864b972ac3f7b6bfbdfc02a5c0aa4f486b56fa55352a92ce9**.
- All 14 historical operational SQL files match independently read raw base Git LF blobs. Windows checkout CRLF distinguished from tested LF; no migration-history edits or checksum bypass.

```text
canonical SQL  72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7
runner         f3ab77d74f022b157e00530190962290f3ca02debe470898b141b88bc563de00
Cargo.lock     9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc
SDL            8ef6b6fc17b878e5894bff917561d5020fe4269f79939546a64b9b904cf5fe95
```

Adjacent `BACKEND-CLOSURE-REVIEW.source-manifest.json` identifies all 226 frozen local files. Four actually executed unoptimized test binaries identified in `tested-binaries.sha256`; not optimized release binaries.

## Isolation, evidence, cleanup

Owned root: **`/home/azuraith/task-scheduler/rehearsals/gm-20260907/closure-verification`**. Only runtime DB: **`gm_closure_verify_20260907`**, owner **gm_tester**. Root/DB confirmed absent before exclusive creation; own marker verified. TESTENV container labels/root/data mount and exclusive **127.0.0.1:55435** verified. Source/build copied without shared regular-file inodes; other owners' source/build/evidence/DBs untouched.

Seven secured nonempty dumps retained: empty, three pre-suite, two pre-HTTP-fault, final. Backups precede destructive resets/faults. Final check: owned jobs exited; no owned processes, listener58073 or other own-DB sessions; strict port rebind succeeds; DB deadlocks=0, successful migration entries=15. DB/evidence retained for release owner; do not remove shared container.

Raw artifacts under owned `evidence/`: `{mounted,retained,permanent}.{command,out,err,rc}`, `source-{before,after}.json`, `local-{before,after}.json`, `changed-source.json`, `compatibility-only.diff`, `test-guard-adaptations.diff`, `historical-git.json`, `tested-binaries.sha256`, `final-summary.json`, `cleanup.txt`, `evidence-final.sha256`. Independent helper scripts retained at owned root. Local evidence copy: `plans/reports/backend-closure-review-evidence-260907/` in worktree; no production data downloaded.

Operational failures disclosed: initial SSH quoting attempt failed before execution. Post-test wrapper's immediate strict port rebind failed **after all test commands passed**; subsequent listener/process/DB checks and strict rebind independently passed. Initial wrapper traceback retained, not erased. Existing compiler warnings retained; no warning-free claim.

## Remaining gates / boundaries

Source frozen for integration, **not production promotion**. Optimized assembled backend/frontend build, final assembled manifest/LF packaging, deployment backup/rollback/readiness, authenticated Firebase/JWT transport and released browser flows remain later-owner gates. No full cargo suite/clippy/coverage certification. No product/config/SQL/runner/lock/authorization-predicate/PM-ledger edits; no production5434 access, browser, agents, hooks bypass, commit/push/deploy.

Required skills applied: `ak-code-review`, `ak-test`. Primary startup docs read in order; plan/acceptance/decisions, both predecessor reports, manifest, TESTENV and DESIGN read. Root README/local development rules absent; global rules used.

Unresolved questions: **none**.
