# INTEGRATE — release branch foundation handoff

Status: **DONE_WITH_CONCERNS — intentionally paused for final owner fixes**  
Checkpoint: 2026-09-07 Asia/Bangkok

## Boundary

- Release worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/release-20260907`
- Branch: `codex/gantt-members-clone-release-20260907`
- Base: `704d5221b227a2a8491e54a236b8b980108e4c63`
- Primary checkout and source worktrees kept read-only. Only primary write: this required report.
- No deploy, push, PR, primary merge/checkout, database/source mutation, dependency upgrade, nested agent, browser, or server.
- Frozen Gantt imported. Rejected/provisional member+clone bytes not imported. Integration intentionally incomplete.

## Foundation checkpoint

Commits, oldest first:

```text
6958fa808a6764db4748742037171a83ecccc2df  chore(migrations): enforce LF artifacts
8f96b543783ce5e5344ce36eac0be43ecfa322f6  chore(backend): pin verified Cargo lock
f2e6384500117f125663799015f5e51bc326bdc4  feat(gantt): integrate resource planning authority
3b6fd6065d0759cd64e08d586ac342ef1e77d485  docs(release): document Gantt and artifact contracts
```

Last observed release status after commits: clean. No provisional member/clone files or corrected new migration exist in this branch.

### Migration LF policy and bytes

- Added only `.gitattributes`: `backend/migrations/*.sql text eol=lf`.
- Own checkout initially contained CRLF because of Windows checkout conversion. All 14 files were rewritten CRLF→LF only; bare CR rejected.
- `git diff --ignore-space-at-eol -- backend/migrations`: no semantic diff.
- Important evidence conflict: direct `git cat-file blob` proved all 14 base `704d5221` objects already LF and byte-identical to current objects (`base_head_same=14/14`, `base_blob_cr=0`). Therefore Git had no SQL blob delta to commit; `6958fa8` contains the narrow policy only. This contradicts the supplied/report premise that base Git objects were CRLF. No fake same-byte SQL commit created.
- Controlled archive command `git -c core.autocrlf=false archive ...`: historical SQL CR count `0`.
- All archived LF SHA-384 values match `MIGRATION-ARTIFACT.md` and deployed SQLx checksums:

```text
20230705000001 d29352e3a179e0cfd192cb1675cd810faff57dc688d55121e84a3ad440a3a111c9ad3efcb968c7cea32f7eeedfcf62e8
20240616000001 ed4f4682a66fe0072b1d6ba1d6fb9c44fbd677ccdbfca58036f122ad5b4b8fb539b8b0c7b6d79d74940a37dc442eb62b
20250319000000 bf5bde0370b5ee9f90137742755cf791c19e193f87c23f5e721e29f3af4bb144d60f0f733aeef0ad8747de4629b8ff59
20250408000000 6227b5dffff8793398776aa3231b377cc3e9d2e9084842c8c08f41be606c5525349adddc703838ec37c3b0bba0ee0d4a
20250501000000 c9b71ae77c0a112562265683c25248bbf229a2202bb46aef7da8a516376bf9f01b1ccd62782cfc081dced0001f0aeaec
20260325000000 77bca6214624d62869050f1122fe0d90ec3b3157c536308add8f02552231a7d6296cb540f3a8ca4aed159eabe345a6a0
20260328000001 8a2664ff5f52a55e8337def87cad5761961408b08769d3bbd2cbe6ba75f43dd5c198c04cee1211ba2456f325cd5c06ee
20260901000100 94ad372b623d3318d9af3fd952538ac56a45e3ae4085057f6e0e93152df72a658ba7978e323ed00915fbc9a5b475d1dd
20260901000200 f1a05054a918758201b0a5b6b9d5c618fa1833c844dd2a92d9c5845a4e079ec96402e55346a694acdc2b4d44416eb241
20260901000300 a74348f30008a8b0ec704340d2195dab96940d302453c148ae186578f837e8667711c981913eb357381586038bd1cc46
20260905000001 ac498d734971ea883e60e064e014c8f1385258f9d0697c69fda48df2bf0bb5a47eb5cd7565173e79248d5436c2362ddd
20260905000002 33323e62ea506e58d8fbc9375c5a9fbd595ed4035fd6c37fab4627d9bf02e535196752334869170610884f40db0ffe16
20260906000001 06689582ff44a29ff9e2438e18fd66a0735f549d3490f6dade01a87b51a1231f7afac52f38ac3ff09db5ac999bf16c29
20260906000002 310d49ea93d9554db24ee9d3de6ec74997edcaaf7ef66b600ecc3944f31ef6ebefcf1d0ea5097cb817fbe4e2d9fee949
```

The provisional new SQL was not imported. Last rejected source hash remains `6484c09a8c602bd30a535eb532c000b8277fcce7229251ab902ced5af55e952a`; FR-M2 correction is now explicitly owner-authorized but requires a new hash and complete migration rehearsal before integration.

### Cargo.lock provenance

- Source member/API tree had no `Cargo.lock`; Dockerfile requires `cargo build --release --locked`.
- Copied read-only from retained tested artifact:
  `/home/azuraith/task-scheduler/rehearsals/gm-20260907/member-verification/build-source/Cargo.lock`.
- Identical lock and manifest also exist under retained `artifact-verification/runner-source`.
- Both retained copies:
  - `Cargo.lock` SHA-256: `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc`
  - `Cargo.toml` SHA-256: `6ef60df99d4df3bcf2c2355ae83374d1b4086296f5e77b3e373aa5cfa7e2b247`
- Committed lock blob matches `9d8d...`; release `backend/Cargo.toml` matches `6ef60...`. `MIGRATION-ARTIFACT` previously built successfully with this pair using `cargo build --locked --bin migrate`.
- Default Windows `git archive` exported the lock with CRLF and hash `e03ba0e6c315f3d7f6c4300838e0609698bd7c80f11ee2196e0a2edd57e6a690`. Controlled `git -c core.autocrlf=false archive` preserves LF and exact tested lock hash `9d8d...`; final packaging must use and reverify that controlled form.
- No dependency resolution or upgrade performed.

## Frozen Gantt import manifest

Source: `C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907`, frozen/released after `GANTT-AUTHORITY-FIX.md` final. Exactly 19 product/test files copied. Source start/end and destination physical SHA-256 matched `19/19`; clean-filtered source objects matched committed release blobs `19/19`.

Manifest SHA-256 over sorted `sha256  path` LF lines: `81789c3a5842cdf24ff5aca207f6736e542f8235b00aa122961313416c77c5a0`.

```text
31a17c3b3dd83cf5d759b9d51ad1b01ce24a4c57a3363f2876a02aeff8967f47  web/src/components/timeline/PlanLifecycleBar.tsx
cbfd3c2997dd55d643d0b2f8e3bd48a5bfa340442f34c333ce4b0a6abfab3159  web/src/components/timeline/Timeline.tsx
eba456c741e8b5b11550d8a0e2e6dfcd2fa35eeefcadee753d2597877bbd6225  web/src/components/timeline/__tests__/gantt-hierarchy.test.tsx
9cde3821fd07846009de1782b1c9a50b26ff920e09fe20b12376348abe6b391b  web/src/components/timeline/__tests__/increment1-modes.test.tsx
3642f000746c378014a9e0ac7309dba570668b9ed4fd2d43c9eed6c7383aab0b  web/src/hooks/usePlanLifecycle.ts
66dd82178529d072cc68a92a0fd83ee21ea5414e205f8a3bf3d88dafe4851917  web/src/hooks/useProjectSchedulingConfig.ts
d34df41a71442e910472a4388eba99a17af4b4bb7d1e57a9050ed3946bbef14e  web/src/utils/__tests__/gantt-rows.test.ts
400ec475d0475c3882970b8713aaf34912ea300f8c74b2928809134a51b121ad  web/src/utils/__tests__/plan-lifecycle.test.ts
9ebe877b4c072b8c2bcaea8f6be3d8b6e5b816b815ea1c12092bc3ea90df8b22  web/src/utils/__tests__/task-allocations.test.ts
77a19868d75765b7f82b28e8e5ed09975a6cf2029feed4a6830ba2c4d6d7638a  web/src/utils/ganttRows.ts
f2ecfb82191465f3bee54239b23b28bbc37c98d34cc5133f808b0ea1e9c1ce26  web/src/utils/planLifecycle.ts
797f496112af2cf935a3f263f851751af6a151f8614e9af497c5fd1881644ddc  web/src/utils/taskAllocations.ts
3aeb83896fb4c2032026cc9e762245b27aab6b7692eca107c26807945c7f0329  web/src/components/timeline/MemberDailyEffortMatrix.tsx
ebdb7cbee87e3853a0b680c30fba4baa8b53d02a8280d5674b270277802c9fcd  web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx
d91e7481e45a49875b0c1f27c0262dbba99d3de85c89f94da6b6cd5801a868aa  web/src/hooks/__tests__/plan-lifecycle-authority.test.ts
3bc798c77ebba66eac573c98fe2465b8ead5f35e9d61d73e574c6aa4b56e39e6  web/src/hooks/__tests__/scheduling-config-authority.test.ts
0d9ed7a0c246640cfa0cd6d82781abc36db3a1f03c5c1fcbb3fc8a7a59756f1a  web/src/utils/__tests__/gantt-authority.test.ts
7efd742733e898cd5a39bd204333033de5fa3795afa5cf11ef7fee517812e137  web/src/utils/__tests__/member-daily-effort.test.ts
ddbb8c025b47296bd38515fc5f5b42678de7ca2b95264eb8906c1260f57ae739  web/src/utils/member-daily-effort.ts
```

Known handoff concern preserved: R6 multi-heading WBS section association needs independent Gantt review. This integrator does not self-approve.

## Checks completed in release worktree

Dependency reuse precondition:

- Release/members/Gantt `web/package.json` SHA-256 all `0a18c993c550993fa5a4b925089304f2c9e12c7d0949c3bfa5f056f7d7604e3d`.
- Release/members/Gantt `web/package-lock.json` SHA-256 all `6d2608aa26e143bb5fd4870a128e1c7fb313e0f307b43fe89c554e4997aaccd4`.
- Temporary junction used only from release `web/node_modules` to members `web/node_modules`; no install and no target mutation intended.

Results:

- Gantt focused gate with explicit `jest.config.js`, `--reporters=default`, `--runInBand`, `--silent`, `--no-cache`: **11 suites, 105/105 tests PASS**, 0 snapshots, 33.726s.
- `npm run build`: **PASS**, compiled and generated 11 static pages. Existing config explicitly skipped type validation and linting; this is not a type/lint pass.
- Unfiltered release `tsc` was not rerun in this bounded checkpoint. Producer's final sequential evidence remains exit 2 with 303 established source diagnostics and no changed-product diagnostic; final combined integration must rerun and distinguish baseline.
- Gantt import `git diff --check`: PASS before commit.
- No clone/Excel/member combined tests run because their final owner fixes are active and rejected bytes were intentionally excluded.
- No backend build/test run here. Final backend artifact gate remains packaging/release worker ownership with verified lock and database metadata/secret supplied by non-echoing build path.

## Docs and navigation

Commit `3b6fd60` updates only owning docs already verifiable:

- `docs/system-architecture.md`: selected live/saved plan owns synchronized hierarchy, allocation-only bars, member/day matrix.
- `docs/deployment.md`: committed archive, LF migration checksum verification, matching committed lock, `--locked` build.

Navigation verification: `docs/README.md` links `system-architecture.md`; primary `AGENTS.md` mandatory startup sequence links `deployment.md`. No authority plan/acceptance/decision-ledger edit. Canonical member table/view, assignment, clone, and Excel docs remain pending final accepted source.

## Cleanup and preserved artifacts

- Removed own `web/node_modules` junction; members target remains present.
- Removed own generated `web/.next`.
- Owned Node/Jest/Next processes after cleanup: `0`.
- Temporary archive/manifest directories removed.
- Preserved source worktrees unchanged. Preserved retained remote verification artifacts/DBs unchanged.
- Reviewable artifacts are the four scoped local commits above; no push/PR/deploy.

## Remaining release gates / continuation manifest

1. Await backend authority fix for FINAL-REVIEW FR-H1/H2/H3/M1/H5 and new mounted/concurrency evidence.
2. Await List/clone UI fix for FR-H4/M3 and focused wiring evidence.
3. Await controlled FR-M2 correction of `20260907000001_consolidate_project_members.sql`; record new SHA-256 and rerun full populated upgrade, bootstrap, preservation, negative-trigger and readiness proof. Preserve historical migration semantics/checksums.
4. Recopy the complete final members/clone backend+web product/test manifest from released owners. Rehash source before/after and destination; report conflicts instead of assuming overwrite.
5. Import no reports, AGENTS/CLAUDE, NUL, node_modules, environment/secrets, local state, or verification build outputs.
6. Independent Astra Gantt review against commit `f2e6384500117f125663799015f5e51bc326bdc4` and manifest `81789c...`; resolve/report R6 only through owner handoff, not integration edits.
7. Update minimal owning docs for final canonical table/view, assignment, List/Excel and clone behavior.
8. Run combined explicit Gantt+clone+Excel/member focused tests, unfiltered `tsc` with baseline comparison, build, `git diff --check`, source/import hashes.
9. Produce final controlled Git archive; verify all 14 historical SHA-384 values, corrected new SQL SHA-256/LF bytes, exact lock `9d8d...`, manifest/commit identity. Packaging worker runs final backend `--locked` artifact test/build.
10. Send assembled manifest to independent final reviewer. No self-approval, deploy, push, PR, primary merge/checkout, production write, or browser release check without separate PM release.

## Unresolved questions

None. Remaining dependencies are explicit owner/review gates.
