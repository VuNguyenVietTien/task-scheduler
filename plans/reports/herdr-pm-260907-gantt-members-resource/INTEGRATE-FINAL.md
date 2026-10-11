# INTEGRATE-FINAL

Status: **DONE_WITH_CONCERNS** — mechanical integration complete; promotion blocked by independent frontend findings and new unimplemented scope. Finalized 2026-09-07 17:59 Asia/Bangkok.

## Boundary

- Worktree: `C:/Users/TienVNV/Documents/prjmngr/worktrees/release-20260907`
- Branch: `codex/gantt-members-clone-release-20260907`
- Base: `704d5221b227a2a8491e54a236b8b980108e4c63`
- No source worktree writes, semantic conflict merges, dependency install/update, backend execution, database connection, browser, server, push, primary merge, PR, deployment or production release.
- Sole primary-tree write: this required report. `NUL`, AGENTS/CLAUDE, reports other than this one, local state, dependencies, build outputs, environments and secrets excluded.

## Commits and immutable checkpoints

Oldest first:

```text
6958fa808a6764db4748742037171a83ecccc2df  chore(migrations): enforce LF artifacts
8f96b543783ce5e5344ce36eac0be43ecfa322f6  chore(backend): pin verified Cargo lock
f2e6384500117f125663799015f5e51bc326bdc4  feat(gantt): integrate resource planning authority
3b6fd6065d0759cd64e08d586ac342ef1e77d485  docs(release): document Gantt and artifact contracts
1f63e251daee568f50e313baab9adc84de80b6cd  feat(backend): integrate canonical project members
8dcbb2800fb5238200fa0ada01e772f5e7fb043c  feat(web): integrate members clone and Gantt workflows
049a6c5ddf31de2c373ae69c384bb2e0a14089d7  docs(release): document canonical planning contracts
```

Backend preparation was given immutable commit `1f63e251…`. Independent frontend review was given immutable source commit `8dcbb280…` and the assembled manifest before docs/build work.

## Backend import and authority

- Source: frozen `members-20260907`; copied exactly its 36 changed/untracked backend source/test/SQL/SDL paths. No stale member web copied.
- Frozen closure manifest: `BACKEND-CLOSURE-REVIEW.source-manifest.json`, 226 files; manifest-file SHA-256 `bffe1586e8211585ed5127bfb632cb0cf0c9a85569b6b7a2afbf4540fdd6a324`.
- Before copy: 226/226 physical hashes matched; 36/36 imported paths belonged to the manifest; source→destination physical hashes matched 36/36.
- Committed clean-filter proof: 226/226 blobs match the closure manifest's LF identities.
- Latest independent authority: `BACKEND-CLOSURE-REVIEW.md` PASS. It independently passed 29 contract + 1 mounted flow + 5 retained review + 3 permanent compatibility tests. Integration did not self-approve or repeat database qualification.
- Canonical SQL: `backend/migrations/20260907000001_consolidate_project_members.sql`, SHA-256 `72f8929eab9503264af6af89a1fc8e7040123690af163aba8e203dbc362cd8c7`.
- Cargo.lock: SHA-256 `9d8d849d6dfae3374db07e09ba35ead06ca1564825d9d5481c98e5eecf956bfc`.
- Cargo.toml was not edited: Windows source hash `6ef60df99d4df3bcf2c2355ae83374d1b4086296f5e77b3e373aa5cfa7e2b247`; committed/archive LF identity `2fac8d30de67576b039d219ad8157498f18e81904683ba678b2542b0d408efa0`, matching the closure manifest's LF field. No dependency resolution.

### Backend-only archive checkpoint

```text
Command: git -c core.autocrlf=false archive --format=tar -o <archive> 1f63e251daee568f50e313baab9adc84de80b6cd backend .gitattributes
Path:    C:/Users/TienVNV/AppData/Local/Temp/projectmanager-backend-1f63e251daee.tar
SHA256:  0b8aa9dc0c92c7d37104dfa06587d8cddc6e2b170bec601464ac289af6e68003
```

Extracted archive verification: 226/226 backend entries matched recorded raw or LF identities; SQL `72f8929e…`; lock `9d8d849d…`.

## Frontend import manifest and ordering

Combined approved source/test manifest: **49 unique paths** = List/clone 21 + Gantt 27 − three overlaps + task-count 4.

- Manifest: `C:/Users/TienVNV/AppData/Local/Temp/frontend-assembled-source-manifest.txt`
- SHA-256: `31d34a892c1594ccedb8730fe3fa76ab0056c4e3cdcaa007a5dc69c8a7468318`
- Committed clean-filter/archive proof: 49/49.

Import order and evidence:

1. **List/clone first:** verified 21/21 frozen hashes from `clone-dialog-20260907`. This includes the original 17, final seven owned changes with overlap deduplication, and superseding count-addendum identities: `ProjectDetailView` `71c08845…`, `TaskListView` `ec08f10a…`, parent test `c3f23d55…`.
2. **Gantt second:** `GANTT-ROW-BOUNDARY-FIX-manifest.txt` SHA-256 `b62827b2461dc4e01aadad2807f8a42f58cf31be83563b54c9790d32574ec500`; 27/27 source hashes matched. Final `Timeline.tsx` is `8ea39643…`; nested-boundary regression is included.
3. **Shared read model resolved Gantt-last:** `tasksSlice.ts` `d94cd0cc…`, `graphql/queries/tasks.ts` `76683cf6…`, `graphql/mutations/tasks.ts` `b7180d4a…`. The first two add all-depth TaskTreeRows reconstruction, priority/order and freshness guards on top of List's canonical resource normalizer; mutation document stays identical. Exact List→Gantt three-file patch: `C:/Users/TienVNV/AppData/Local/Temp/list-to-gantt-shared-read-model.patch`, SHA-256 `42cb6a84241101d598924cbdf20b2c4629a6eb452024cf65db7362d0f3b1fb3a`.
4. **Task count last after PM freeze:** copied only four named Report/helper/test paths; 4/4 matched `TASK-COUNT-CONSISTENCY.md`. No dashboard files copied or edited.

No other source conflicts occurred. Source remains at `8dcbb280…`; docs are the only later commit.

## Checks and raw evidence

### Frontend focused tests

Existing 24-suite combined command used repository `jest.config.js`, explicit default reporter, `--runInBand --silent --no-cache`, no install or config write.

- Initial run: **22 suites loaded and passed, 197/197 tests PASS**. This comprises final Gantt **136/136** and non-parent List/member/clone/Excel **61/61**. Two suites could not resolve aliases because repository Jest mapping does not provide general `@/*`.
- In-memory general alias rerun: report count suite **2/2 PASS**.
- Actual parent suite: **9/9 FAIL** after loading. Its unchanged fixture returns old `{data:{tasks}}`; final Gantt thunk requires `{data:{task_tree_rows}}`, so actual ProjectDetail renders `Task tree response is missing`. This is an assembled retained-test contract mismatch at the List/Gantt shared seam. No test or product source changed by integrator.
- Independent review checkpoint separately confirms member 8, report 2 and nested Gantt 3 pass, reproduces the same parent nine failures, and is adapting only Temp copies while preserving assertions.

### Build

`npm run build`: **PASS**, exit 0. Next compiled and generated 11 static pages. Existing configuration explicitly skipped type validation and linting; this is not a type/lint pass. Only stale Browserslist/caniuse data warning observed. Raw log: `C:/Users/TienVNV/AppData/Local/Temp/integrate-final-build.log`.

### Full unfiltered TypeScript comparison

Executed sequentially after build with `--noEmit --pretty false --incremental false`.

```text
Original 704d5221 baseline: exit 2, 304 source diagnostics
Assembled current tree:    exit 2, 300 total = 296 source + 4 generated .next/types diagnostics
Normalized signature diff: 0 added source diagnostics; 8 source diagnostics removed
```

The four added signatures are generated `.next/types` GraphQL-route/timesheet diagnostics created by build. One pre-existing diagnostic remains in an approved Gantt test; no new approved-source diagnostic. Raw logs:

- `C:/Users/TienVNV/AppData/Local/Temp/integrate-final-tsc-baseline-704d5221.log`
- `C:/Users/TienVNV/AppData/Local/Temp/integrate-final-tsc-current.log`

No filtered-zero result is presented as a pass.

### Git/docs

- `git diff --check`: PASS before each scoped commit and final tree.
- Scoped staged secret-pattern scans: zero hits.
- Package and lock matched dependency source before junction: package `0a18c993…`, lock `6d2608aa…`; no install.
- Minimal owning docs updated: [system architecture](../../../../docs/system-architecture.md) records the one-table/compatibility-view decision, link-vs-access, stable unlinked assignment, all-depth task/Excel/clone owners, and selected-plan Gantt resource owner. [deployment](../../../../docs/deployment.md) records controlled archive, LF/checksum/locked-build gate and forward-only backup/restore rollback constraints. Ten referenced source paths exist.
- No docs claim this artifact was deployed or accepted. New editable `progress_type` catalog and phase-only Master Schedule behavior are pending scope, not documented as current accepted behavior.

## Final controlled release archive

```text
Commit:  049a6c5ddf31de2c373ae69c384bb2e0a14089d7
Command: git -c core.autocrlf=false archive --format=tar -o <archive> 049a6c5ddf31de2c373ae69c384bb2e0a14089d7
Path:    C:/Users/TienVNV/AppData/Local/Temp/projectmanager-release-049a6c5ddf31.tar
SHA256:  3249548725758b92b042c2d63b3cbf8c6636c1a37ccffca814322ad5ae8c262d
```

Tar-level parser verified all 226 backend and 49 frontend approved entries byte-equal to committed blobs. All 14 historical SQL files contain no CR and match the required SHA-384 values from `INTEGRATE.md`; new SQL and lock hashes match above. Archive has 1,553 regular-file entries. A Windows tar extraction warned on an archived symlink with an invalid Windows link target; direct tar parsing/blob comparison provided the complete byte proof instead of treating extraction as clean.

## Cleanup / retained shared state

- Own baseline extraction/junction/archive scratch removed; failed PowerShell junction removal was retried with `cmd rmdir` and cleanup confirmed.
- No owned release Node/Jest/tsc process remains.
- Per PM request, release `web/node_modules` junction and `web/.next` are retained while the independent reviewer runs. Junction target is `gm-20260907/web/node_modules`; target was never removed or installed through. **Cleanup owner remains INTEGRATE-FINAL after PM confirms reviewer completion.**
- Git status otherwise contains only inherited excluded `?? NUL`; junction and `.next` are ignored.

## Blocking findings / remaining gates

1. Independent assembled reviewer rejected TASK-COUNT's dashboard no-edit rationale: real Apollo routes to Rust `TaskQuery.tasks`, which returns a root forest; dashboard query omits children. Controlled root→child→grandchild result is total 1 / doing 0 instead of 3 / 1. A producer must fix and independently re-review; integrator made no semantic edit.
2. Existing ProjectDetail parent fixture must be updated by the owning debugger for TaskTreeRows without weakening its nine assertions. Independent Temp-adapted cross-module tests are still running.
3. New user scope is pending: editable `progress_type` catalog and Master Schedule phase-only display while WBS retains hierarchy. Project/global catalog ownership still needs PM clarification. Not implemented here.
4. Await final `FRONTEND-ASSEMBLED-REVIEW.md` verdict. Current checkpoint is not acceptance.
5. After any source delta: new immutable frontend commit/manifest, rerun focused/parent/dashboard tests, sequential build/type comparison, docs review and final archive.
6. Backend optimized `--locked` artifact test/build and hash binding remain release-preparation ownership. Prepared backend archive may be reused only if later frontend-only changes do not alter backend ancestry/content.
7. Database backup/migration/readiness, authenticated transport, released Chrome persistence and complete browser acceptance remain unexecuted release gates.
8. No primary merge/push/deploy until explicit PM release after independent backend and assembled frontend acceptance.

## Unresolved questions

- Is editable `progress_type` catalog project-scoped or global?
- Which producer owns the dashboard descendant query/count correction and parent fixture update?
