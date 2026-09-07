# Checkpoint: Gantt, catalog languages, Excel

User requested checkpoint/push instead of deployment. **Not release-ready. No new deployment or primary merge.**

## Completed on this release branch

- Prior integrated catalog/member/Gantt/clone work retained through base `f921253538180e7e968b3491f75b830cfd28b6b9`.
- Gantt User picker now uses canonical scheduling/project members, including unlinked and zero-allocation members. Resource identity wins; user-only legacy assignments map via canonical membership, never names. Matching descendants retain ancestor context; clear restores all. Saved filtering uses snapshot assignment, not current-task inference. Matrix code/sums unchanged.
  - Changed: `web/src/components/timeline/Timeline.tsx`, `web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx`.
  - Producer verification: existing owning suite27 passed/1 failed due a new fixture using camel userId at a snake-case API boundary; corrected that fixture only, affected case1/1 passed. All28 cases passed across these runs. No independent approval of this worker's Gantt change.
- Fixed en/ja/vi catalog fields, aligned per-language paste previews, stable selected IDs and preserved extra-locale labels imported from frozen `codex/catalog-languages-20260907` worktree `../lang-0907`.
  - Six owner files verified byte-for-byte before/after import; producer manifest SHA256 `9ad2b0cea8c287b956675d3b7d13f1ac930dc061d22bf1ac53165d198d8e9d3e`.
  - Four focused suites19/19 passed after import.
  - Independent real existing SettingsPanel/i18n/selector test passed: en/ja/vi label/localStorage updates, stable selected ID, no selection mutation.
  - Independent defect found/fixed only in release: trimming edge-empty translation cells silently shifted labels between items. Parser now preserves positional blanks (single final newline treated as clipboard terminator). Regression retained in `web/src/utils/__tests__/project-catalog.test.ts`; affected paste checks6/6 passed. Frozen language owner untouched.

## Unfinished Excel checkpoint — separate branch, NOT imported

- Branch: `codex/excel-editing-20260907`; checkpoint commit `4faa28887fcf5f9f4adf0b33128ccb315cad47a7`; worktree `C:/Users/TienVNV/Documents/prjmngr/worktrees/excel-editing-20260907`.
- Provider quota stopped producer; no final EXCEL-EDITING report or producer manifest. PM confirmed four-file freeze; integrator generated/verified hashes before and after tests.
- Four intended files only: `web/src/components/tasks/TaskExcelGrid.tsx`, `TaskListView.tsx`, `__tests__/TaskExcelGrid.test.tsx`, `__tests__/TaskListView.assignment.test.tsx`.
- Proposed changes: cell focus recovery, Tab editing, one-click canonical assignee select, TSV selection copy, localized catalog columns, normal/Excel confirmed effort refresh/error retention.
- One fresh focused run: **TaskExcelGrid16/16 PASS; TaskListView.assignment0/7 PASS (7 FAIL)**. Failure signatures: `fetchProjectTasks.fulfilled.type` undefined and missing `state.tasks.tasks` under the test's Redux/module mocks. This is failed verification, not proof every product path is broken. No repeat debug cycle or import performed per user instruction.
- Frozen raw SHA256, unchanged through testing/commit:
  - `TaskExcelGrid.tsx`: `976e00a28770063be1a86f76c28d3b9312ba5e3161f2b94dfb516dbaf86e6865`
  - `TaskListView.tsx`: `ce5832f916e56c2ea297c7093cf2098ee757f8d5205be649d8106334f9a0d648`
  - `TaskExcelGrid.test.tsx`: `dcfb937c0f1f33365f4b2b3318045c35b57a3540eabe5e868cbec89182c0d4f8`
  - `TaskListView.assignment.test.tsx`: `839accf3ab5f5691338d622d7f3104f166e4c968ea6e909be229489d64716edb`
- Next: repair/understand test harness without replacing real behavior; rerun affected assignment/effort cases, then import exact reviewed files into release. Preserve source checkpoint/hashes and earlier features.

## Remaining verification / release work

- [ ] Independently review/test Gantt User live linked/unlinked descendant filtering and saved-history identity; Chrome acceptance remains unverified.
- [ ] Finish Excel above; actual focus-away + Normal→Excel return typing, one-click linked/unlinked set/clear, selected-range copy/TSV paste, invalid/ambiguous assignment, stable row IDs/parents and Save/Discard/error retention.
- [ ] Real List/Excel locale switching from existing profile Settings; selected IDs unchanged. Check real snake-case flat query data, not only camel-case test fixtures.
- [ ] Actual normal/Excel effort authoritative response and rejection/partial/missing-result behavior, immediate display and reload persistence.
- [ ] Existing task-detail/full-page/create selectors were source-traced to shared ProjectCatalogSelect but full mounted save/reload flows not reverified here.
- [ ] Combined baseline-aware typecheck and build **not run** after checkpoint steering. Prior TSC was non-clean: **290 source + 4 generated diagnostics**, exit2. Require zero-new-source comparison; Next build explicitly skips types/lint. Never call TSC clean.
- [ ] New production Vercel deployment deferred by latest user instruction. Current production remains `81fbbc48174621824192367c02e99b4e9fee274c`, Ready `dpl_G3uaGFRjJgXKU9iJbAv1FMSBNP46`, alias https://prjmngr.vercel.app (read-only verified this session).
- [ ] On later authorized deployment: one immutable LF Git archive/build, stage **parent containing web/** and `.vercel/project.json`; project Root Directory stays `web`. Do not deploy `--cwd staging/web`. CLI59.11.7, scope `vunguyenviettiens-projects`, project `task-scheduler`; command-local `NODE_OPTIONS=--use-system-ca`, never disable TLS. Verify exact SHA/deploymentID/Ready/alias.
- Preserve current frontend rollback plus older `dpl_D82fpkRkvNPCZxh2k5HzifbA7w1E`. Ubuntu stays backend616fa/16migrations; no DB/runtime/schema work or automatic restore after accepted writes.

## Evidence / continuation

Primary report root: `C:/Users/TienVNV/Documents/prjmngr/task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/`.

- [Release checkpoint](../../task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/EXCEL-LANGUAGE-RELEASE.md)
- [Language producer](../../task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/CATALOG-LANGUAGES.md)
- [Prior assembled review](../../task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/CATALOG-ASSEMBLED-REVIEW.md)
- [Current Vercel](../../task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/VERCEL-NOW.md)
- [Backend release/rollback](../../task-scheduler/plans/reports/herdr-pm-260907-gantt-members-resource/RELEASE.md)

Evidence: `C:/Users/TienVNV/AppData/Local/Temp/excel-language-release-260907-1949/` (commands, logs, JSON results, Gantt and quota-frozen Excel manifests). These local links require the documented sibling primary checkout; they are not portable GitHub artifacts.

No dependency/install/lock/config changes; shared node_modules junction and inherited `.next` preserved. No owned Node/Vercel process at checkpoint. Inherited untracked `NUL`, primary user files and PM authority files preserved. Host wall clock jumped +7h during session; no system-time change performed by this worker.

Unresolved questions: none. Resume unfinished checks above; deployment needs renewed instruction after this checkpoint.
