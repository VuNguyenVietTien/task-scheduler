# EXCEL-LANGUAGE-RELEASE

**Status: DONE_WITH_CONCERNS — requested Git checkpoint completed; unfinished work preserved. NOT deployed/release-approved.**

## Final user steering and exact pushed checkpoints

Initial immediate-deploy authorization was superseded by explicit checkpoint/push/remaining.md request. No deployment was in progress; none started. No primary merge, force push, DB/backend/runtime/schema operation.

| Scope | Exact Git commit | Verified origin branch |
|---|---|---|
| Gantt User + catalog languages + remaining.md | `341e6ca88802d3937477b2f7ea8230c2683abca6` | `codex/gantt-members-clone-release-20260907` |
| Unfinished quota-frozen Excel, separate checkpoint | `4faa28887fcf5f9f4adf0b33128ccb315cad47a7` | `codex/excel-editing-20260907` |

Both ordinary `git push origin <branch>` exit0. Fresh `git ls-remote --heads origin` independently returned both exact SHAs above. Origin verified GitHub `VuNguyenVietTien/task-scheduler`; no credential values printed. Prior features/history through base `f921253538180e7e968b3491f75b830cfd28b6b9` retained. Excel commit is NOT an ancestor/import of the release checkpoint.

Durable unfinished ledger committed at **`C:/Users/TienVNV/Documents/prjmngr/worktrees/release-20260907/remaining.md`**. Records actual completed scope, Excel failures/worktree/branch/commit/hashes, missing browser/type/build/deploy gates and continuation links.

## Authority / boundaries

- Role: independent Excel/language tester/integrator/release owner; PM later assigned this worker producer ownership of narrow Gantt User fix. **No independent approval of own Gantt work claimed.** No nested agents, no PM authority edits.
- Runtime environment verified openai-codex/gpt-6-astra; requested max, no separate exposed thinking-env proof.
- Primary AGENTS and startup docs read in order including deployment; active plan/acceptance/decisions, CATALOG-INTEGRATE, VERCEL-NOW, RELEASE, CATALOG-ASSEMBLED-REVIEW. Root README/local rules absent; web README/global development rules read. Relevant ak-test/code-review/deploy/git/scout/debug/cook/fix and ponytail instructions loaded.
- No in-progress writer imports. Language exact6 paths imported only after PM confirmed frozen hashes. Excel exact4 paths inspected/tested only after PM confirmed provider-quota freeze; no producer completion report or manifest invented.
- Host clock jumped from2026-09-07T19:58:15+07 to2026-09-08T03:04:27+07 mid-session (+7h). No system-time changes by this worker. READY reported19:54; Gantt producer freeze19:58. Final remote verification clock03:10:18+07 (nominal20:10 original clock).

## Gantt User — exact cause, change, evidence

`web/src/components/timeline/Timeline.tsx` originally built allMembers from `task.assignee.userId` and optional account-user props; matchesTaskFilter and filteredTasks also compared account IDs only. Actual ProjectDetailView caller passes no users. Thus unlinked canonical members already available through schedulingConfig/resource matrix could never enter the User picker/filter.

Fix reuses schedulingConfig.resourceMembers, including linked/unlinked/zero rows. Concrete resource identity wins even if removed; legacy user-only maps through canonical relation, never names. Both live draft-input selectedTaskIds and displayed filtering use canonical matching; saved filtering reads selected snapshot assignment, not current-task fallback. Existing ancestor context/clear behavior retained. **Matrix source/sums unchanged; live matrix correctness not independently claimed.**

Two changed files only: Timeline.tsx and existing gantt-lifecycle-wiring.test.tsx. New cases cover linked/unlinked/zero choices; child match retains parent; selected live IDs exclude context; legacy linked fallback; clear; unchanged matrix cell totals; saved conflicting concrete resource/removed/null/missing/user-only identities.

Fresh evidence: new6 cases red before fix (membership assertion explicit; existing pretty-format maxWidth bug obscured other assertion diagnostics). Full owning suite after fix **27PASS/1FAIL**. Failure was new fixture supplying camel userId at reducer's actual snake-case API boundary. Corrected own fixture to user_id; affected case **1/1PASS**. All28 cases passed across these runs, not a claimed fresh full28 rerun. PM independent follow-up remains open.

## Language integration / independent correction

Source worktree `C:/Users/TienVNV/Documents/prjmngr/worktrees/lang-0907`, branch `codex/catalog-languages-20260907`, basef921. PM-frozen manifest `CATALOG-LANGUAGES.source-manifest.json` SHA256 **`9ad2b0cea8c287b956675d3b7d13f1ac930dc061d22bf1ac53165d198d8e9d3e`** independently matched; all6 raw source hashes verified before import, destination6/6 matched. Owner source untouched.

Delivered fixed en/ja/vi new/edit fields and aligned paste preview; full replacement labels preserve extra locales and stable UUIDs; existing profile Settings/i18n singleton retained. Shared task-detail/full-page/create selectors source-traced, not fully mounted/reload approved.

- Imported producer tests: **4 suites19/19PASS**, one run.
- Independent actual SettingsPanel + i18n + ProjectCatalogSelect user-event: **1PASS**, ja/vi/en buttons update option text and i18nextLng, selected stable ID unchanged, no change callback.
- Independent dangerous-data counterexample **1FAIL**: en `Alpha,Beta,`, ja `,二,三` became Alpha→二/Beta→三 because parser independently stripped edge blanks. Confirmed silent label/item misalignment.
- Minimal release-only correction in utils/project-catalog.ts preserves positional edge blanks; removes one terminal line ending. Added regression in existing pure test file. **Affected paste checks6/6PASS**, no broad rerun. Those two files intentionally differ from producer manifest; no hidden modification to frozen source.

## Excel quota freeze — unfinished, NOT imported

PM confirmed four-file freeze after producer quota exhaustion. Source `C:/Users/TienVNV/Documents/prjmngr/worktrees/excel-editing-20260907`, basef921. Inspected exact diff, source status and diff-check; generated own raw manifest, verified4/4 unchanged through tests and checkpoint commit. No EXCEL-EDITING final report exists/claimed.

Proposed source scope: focus/Tab editing, assignee selector, selected TSV copy, localized catalog columns, normal/Excel confirmed-effort state update and incomplete-response retention. **One required run of its two focused suites:**

- TaskExcelGrid: **16/16PASS**.
- TaskListView.assignment: **0/7PASS, 7FAIL**; `fetchProjectTasks.fulfilled.type` undefined and missing `state.tasks.tasks` under the suite's Redux/module mocks. This is failed verification, not proof all product behavior fails. Earlier producer partial PASS output lacks final count/config and does not override fresh failure.

Per latest instruction, no repeat debugging, no import of four files into release. Committed/pushed exact coherent unfinished source separately as4faa288; failure and remaining true-interaction/effort/save/locale checks in remaining.md. No independent Excel interaction approval claimed.

| Frozen Excel path under web/src/components/tasks | Raw SHA256 |
|---|---|
| TaskExcelGrid.tsx | `976e00a28770063be1a86f76c28d3b9312ba5e3161f2b94dfb516dbaf86e6865` |
| TaskListView.tsx | `ce5832f916e56c2ea297c7093cf2098ee757f8d5205be649d8106334f9a0d648` |
| __tests__/TaskExcelGrid.test.tsx | `dcfb937c0f1f33365f4b2b3318045c35b57a3540eabe5e868cbec89182c0d4f8` |
| __tests__/TaskListView.assignment.test.tsx | `839accf3ab5f5691338d622d7f3104f166e4c968ea6e909be229489d64716edb` |

## Release checkpoint exact file hashes

All9 intended release files staged explicitly; staged scope matched allowlist, diff-checkPASS, suspicious added credential-value scan0. No broad add/reset or dependency files included. Commit stats9files,+464/-122.

| Path | Raw SHA256 |
|---|---|
| remaining.md | `16569c291965a87972d4e018e4b0c6975a1a755d2c022d93a982666150176a4a` |
| web/src/components/projects/ProjectCatalogSettingsPanel.tsx | `90bd105c8b795f806bfaa7937e38ef23859391ac9991b70c6b61c348683865cb` |
| web/src/components/projects/__tests__/project-catalog-language.test.tsx | `b9f3bcf7d20a14b9d9d362496efb95bb83184cc193ccbcc228a31a107e305087` |
| web/src/components/projects/__tests__/project-catalog-settings.test.tsx | `3855934a4710858b34c14e42f9299004b3974b885934588fe2cdac7a0536a0e8` |
| web/src/components/timeline/Timeline.tsx | `24f9806d2e9384f806478711ec1634df97961f253db4c709b0063b22a8ada7f9` |
| web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx | `77832c8b0c6e6988b0023c7566163988962a8164ce86d57d340bb4b8f015e5e8` |
| web/src/types/project-catalog.ts | `73b56c697062a0260710d25a654f201ad81ec22bb2ab788d4935a72d1d80cee5` |
| web/src/utils/__tests__/project-catalog.test.ts | `830de630b66023139d846db583c76346c7e9444c798c3ea240aa2ef35dd26c9f` |
| web/src/utils/project-catalog.ts | `4833cb3ca87f6eec230fc519822313745d01285bcef79e081ccf75663e163cee` |

Manifest also records exact Git blob IDs (distinguishes Windows raw bytes from canonical Git content). No release archive was generated because deployment/build were cancelled by user steering.

## Build/type/deployment state — limits explicit

**No new typecheck or build run.** User changed scope to narrow sanity/Git checkpoint before combined candidate existed. Prior f921/bd5 TSC remains exit2, **290 source+4generated**; zero-new-source has NOT yet been verified for new checkpoints. Prior Next build skipped types/lint; cannot claim new build/type success.

Read-only initial Vercel preflight: CLI59.11.7, whoami vunguyenviettien; scope vunguyenviettiens-projects, project task-scheduler, IDprj_q4s9b505ULq8NkSwy0FDWMK0uoz3, Root Directoryweb, Node24.x. Command-local NODE_OPTIONS=--use-system-ca, no TLS bypass/settings/env mutation.

Unchanged production at preflight: source **81fbbc48174621824192367c02e99b4e9fee274c**, **Ready dpl_G3uaGFRjJgXKU9iJbAv1FMSBNP46**, https://task-scheduler-1l9ly880g-vunguyenviettiens-projects.vercel.app, alias **https://prjmngr.vercel.app**. This is existing production, NOT either checkpoint. Current deployment and older rollback dpl_D82fpkRkvNPCZxh2k5HzifbA7w1E retained. Ubuntu backend616fa/16schema unchanged, no DB test or mutation. No authenticated Chrome/reload/persistence claim.

Later authorized deploy must use immutable LF archive parent containing web/ + parent .vercel/project.json, never --cwd staging/web; preserve project setting and rollback. Finish remaining.md gates before release readiness claim.

## Evidence, cleanup, continuation

Evidence root **`C:/Users/TienVNV/AppData/Local/Temp/excel-language-release-260907-1949/`**. Retained run-checks.cjs/execute-checks.cjs, expanded commands/configs, numeric exits/raw logs/JSON results, independent affected test, push logs, manifests.

- release-checkpoint-manifest.json SHA256 `895c1bdde47ba02aa6b2d730ec4fdc655f5b0b0aa85053315a6b7d045442985c`.
- excel-quota-frozen-manifest.json SHA256 `6f49bfa5448519cfaf6841d71300366b30debbe848774a5ba2252f195bd1e08b`.
- Harness uses existing Next/Jest, Temp-only general @/* mapper/default reporter, no repository config edit. Source Excel run selected via CHECK_ROOT. Failures retained, not hidden.
- Dependency junction remains release/web/node_modules -> gm-20260907/web/node_modules; Excel same target. Release/target package SHA2560a18c993c550993fa5a4b925089304f2c9e12c7d0949c3bfa5f056f7d7604e3d, lock6d2608aa26e143bb5fd4870a128e1c7fb313e0f307b43fe89c554e4997aaccd4 matched preflight. No install/lock/config/dependency mutation.
- Own Temp test cache removed; **zero owned Node processes**, no Vercel/deploy process/staging created. Shared junction and inherited .next retained. Prior rollback/staging/evidence untouched.
- Final release index/tracked tree clean; only inherited `?? NUL`. Excel source checkpoint clean; frozen4/4 raw hashes still match. Primary user files/AGENTS/CLAUDE/PM authorities untouched; only assigned primary report written.

Unresolved questions: none. Unfinished work is explicitly in release-root remaining.md; resume from the verified remote refs above.

Report: `C:/Users/TienVNV/Documents/prjmngr/task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/EXCEL-LANGUAGE-RELEASE.md`

Status: **DONE_WITH_CONCERNS**
