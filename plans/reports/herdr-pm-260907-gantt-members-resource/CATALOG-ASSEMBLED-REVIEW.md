# CATALOG-ASSEMBLED-REVIEW

**Status: DONE_WITH_CONCERNS. Verdict: REJECT against latest functional UX acceptance.** Confirmed Excel interaction defects and superseded catalog-language UI need changes. This is not a deployment hold: user permits deployment during review. Finalized early at PM request to free the slot for language implementation; no further broad suites.

## Authority and source preservation

Independent reviewer, pane `w1:p2V`, Windows/Asia Bangkok. Dispatch2026-09-07 19:28; checkpoint19:37; final19:46, before19:58 deadline. Read primary AGENTS/startup docs in order, active plan/acceptance/decisions and all requested reports. Root README/local rules absent in both trees; read global rules and web README. Activated ak-code-review/ak-test; ak-debug only for concrete Excel failures. No nested agents.

Candidate **`f921253538180e7e968b3491f75b830cfd28b6b9`**. Independently matched **36/36** paths to manifest SHA256 `fcf3baab7b7daeaf485f741949064c72412607aec309991b5c65497ecc23ed94`. Before19:32:48 / after19:43:46: **1,567/1,567 tracked file hashes identical**, same HEAD, only inherited `?? NUL`. `git diff --check` passed. Package/lock match retained `gm-20260907/web/node_modules`; no dependency/junction mutation. Exact Excel files unchanged between production81f and finalf921.

Evidence root **`C:/Users/TienVNV/AppData/Local/Temp/catalog-assembled-review-260907-1928/`**. Primary manifests: `CATALOG-ASSEMBLED-REVIEW.source-manifest.json` and `.evidence-manifest.json` (55 artifacts).

## Confirmed findings / implementer handoff

### F1 — P1: clicking a cell does not restore keyboard editing

**Paths:** `web/src/components/tasks/TaskExcelGrid.tsx:202–208,394–398,443–453`; `TaskListView.tsx:1469,1546–1554`.

All keyboard/paste handlers live on one `sr-only` input. Cell mousedown prevents default, sets selection and clears typing, but never focuses the input. Its autofocus runs only at mount. Excel stays mounted when Normal mode hides it; subsequent toolbar/tab focus is not repaired by cell clicks.

**Reproducer:** mount actual grid → focus its focusable container (equivalent loss of hidden-input focus) → click title cell → type `Renamed` + Enter. Actual cell remains `Root`; active element DIV. Initial-focus control edits correctly. This is a real interaction defect, not failed persistence: no edit reaches staging/save.

**Evidence:** `tests/excel-user-interaction.test.tsx`, `excel-user-repro.log`, explicit failing test “cell click restores keyboard editing after focus leaves grid”. Existing tests directly dispatch change/key events to hidden input, bypassing this broken focus path.

### F2 — P1: requested one-click assignee picker is absent

**Paths:** `TaskListView.tsx:341–365,1209–1234,1548–1553`; `TaskExcelGrid.tsx:28–40,389–410`.

Actual chain: `ProjectDetailView.tsx:369` → **TaskListView**, not legacy `TaskList.tsx` → TaskExcelGrid. Parent supplies tasks, assignee **label** callback, save and clone only. Cells render plain text; grid has neither member options nor a dropdown editor.

**Reproducer:** click first Assignee cell. Actual component exposes **zero combobox/listbox editors**; Save0 remains disabled because selection is not an edit. PM independently reported same live Chrome result on180 rows/24roots; this reviewer did not access Chrome.

**Fix boundary:** reuse parent’s existing canonical `assigneeOptions`, including linked/unlinked members and duplicate-name disambiguation. Existing `handleExcelSave` accepts exact option label or `resource:<id>` and delegates to canonical assignment hook, retaining clear/error handling. No backend change indicated.

### F3 — P2: selected-range copy is missing

**Path:** `TaskExcelGrid.tsx:249–276,365,443–453`.

TSV paste exists, but no grid `onCopy`/serialization. The table is `select-none`; CSS range selection is not browser text selection.

**Reproducer:** select Root+Child title cells → copy. Clipboard `setData` called **zero times**, expected two-row TSV. Same actual-grid test file/log. Control proves initial-focus typing plus two-row CRLF TSV paste stage3 edits; do not describe all paste/save behavior as broken.

### F4 — P1 acceptance gap: fixed three-language item editor / List classification display

**Paths:** `ProjectCatalogSettingsPanel.tsx:58–90,100–103,190–200`; `TaskExcelGrid.tsx:42–49`; `TaskListView.tsx`.

Latest user correction explicitly supersedes arbitrary locales/Addlanguage. Current new-item preview has one selected locale; existing item editor renders its existing label rows and an arbitrary Addlanguage button. It does not automatically expose English/en, Japanese/ja and Vietnamese/vi fields for every new/edit item. Mounted panel check fails with explicit “Superseded arbitrary Add language editor still present”. This is a new-acceptance mismatch, not proof the earlier agreed wire contract was violated.

List/Excel currently have **no Progress/Category/Task-type columns**, so requested locale-driven catalog display there also needs implementation. Preserve stable IDs and complete-label replacement; never turn localized display names into identity.

## Exact disjoint owner inventory

**Reuse existing profile Settings picker; do not invent another.**

- `web/src/i18n/i18n-config.ts`: existing singleton, supported `en/vi/ja`, fallbacken, localStorage/navigator detection.
- `web/src/i18n/I18nProvider.tsx`, mounted in `app/layout.tsx`.
- `web/src/components/ui/navigation/Header.tsx:128–140`: AccountDropdown Settings action opens `components/layout/SettingsPanel.tsx`; existing buttons call `i18n.changeLanguage`. Standalone `components/ui/language-switcher.tsx` also uses this singleton, but is not a reason to add another picker.
- **Language owner:** `components/projects/ProjectCatalogSettingsPanel.tsx`, `utils/project-catalog.ts`, `types/project-catalog.ts`, focused catalog tests. If required after focused verification: `components/tasks/{TaskDetail.tsx,TaskDetailPage.tsx,NewTaskForm.tsx}` and their tests. These surfaces already consume shared ProjectCatalogSelect/useTranslation; no independent locale state needed.
- **Excel owner exclusively:** `components/tasks/{TaskListView.tsx,TaskExcelGrid.tsx}` plus their focused grid/assignment tests. PM assigned `gm-excel-editing`, including List/Excel catalog display. Import shared catalog selector/resolver; language writer must not edit these files. Existing Redux/task/SDL APIs are read-only dependencies unless separately assigned.

## Fresh checks and their limits

Runner: `node <Temp>/execute-checks.cjs <group> <paths>`. Every expanded file list/config is in `<group>-command.json`; raw log, numeric exit and JSON results retained. Loads existing Jest config with Temp cache, default reporter, in-memory missing `@/*` mapper; no source configuration changes.

| Group | Fresh result / proved boundary |
|---|---|
| `catalogs` | **3 suites12/12 PASS**: actual reusable panel paste/preview/edit/remove/atomic variables, label replacement/order/read-error/project switch; selector IDs; pure fallback/parser; write mapping and recursive null/undefined normalization. Old arbitrary-locale expectations do not approve latest fixed-language UX. |
| `dashboard-parent` | **2 suites15/15 PASS**: dashboard6 + final parent9. Actual hook depth3 has active3/doing1, row-own member filter, dedup, failed-project error, prior-user protection, refresh. Final flat parent fixtures pass all retained clone/count/recovery assertions. Old F2 red fixtures resolved. |
| `retained` | **8/8 PASS**: prior independent actual ProjectDetail/List/Excel assignment set/clear/omit across root/child/grandchild, response/refetch/remount; partial/absent/incomplete assignment response keeps dirty state/no success; actual parent+Timeline+real lifecycle savedB survives rejected refresh/reorder; empty-live savedB works. Retained mocks disclosed in test source; not deployed persistence. |
| `master` | **4 suites71/71 PASS**: phase builder, parser/lifecycle, existing actual Timeline mode/lifecycle fixtures. Positive-day/dedup/gap/multiphase totals, saved optional canonical/alias classification, empty/history cases, phase-only mode and WBS restoration. Some producer UI fixtures substitute child components; not equivalent to new end-to-end Chrome proof. |
| `wbs` | **2 suites6/6 PASS**: retained actual section/independent wiring assertions. Only superseded Master task-row expectations changed in candidate; WBS checks retained. |
| `excel-user-repro` | **1 PASS/3 FAIL**, F1–F3 above, actual grid/user-event. |
| `actual-catalog-final` | **0 PASS/4 FAIL**: fixed-language mismatch confirmed; modal timed out5s, full route could not locate classification control, NewTaskForm dynamic description editor did not mount in this harness. These three are **inconclusive full-surface verification**, not confirmed product defects or passing tests. |

Initial mounted-catalog attempt also failed4/4 (case-sensitive selector assumptions/editor load plus language mismatch). Revised attempt still failed as above. No synthetic editor/component was substituted to manufacture passes. First two Excel diagnostic attempts encountered retained `pretty-format` “Unknown option maxWidth”; final explicit error messages exposed the three real failures without dependency changes. Two PowerShell quoting probes failed before execution; no side effects. All raw failures retained.

## Source/data-flow and baseline disposition

Verified active `app/providers.tsx` → `lib/apollo-client.ts` targets `${NEXT_PUBLIC_BACKEND_URL || production-origin}/graphql`, **not local Yoga**. Catalog/task documents request backend snake-case keys and all3 nullable catalog IDs; update documents retain canonical resource assignment. `useTasks.ts` explicitly rejects partial GraphQL errors/missing update result. `useProjectCatalogs` filters prior-project items; Timeline withholds Master totals on catalog loading/error and uses selected-snapshot IDs, not current-task classification or contextTasks.

Dashboard source uses GET_PROJECTS → TASK_TREE_ROWS with concurrency4, all-project union/distinct IDs and each row’s assignee. Rust project-list source uses owner/non-null-role membership; flat resolver reads all active project rows after existing project-read check. No global-admin policy invented and no adversarial access probe. Original separate SDL-executed dashboard counterexample was **not rerun**; final hook depth3 fixture passed. Backend report remains incomplete; no security scope retried.

Independently decoded retained build/type logs, saved UTF8 copies and compared diagnostic signatures. Build compiled/generated11/11 pages, **explicitly skips types/lint**; retained exit0 is producer evidence, not fresh build. TSC remains exit2: prior **296 source+4 generated**, final **290 source+4 generated**, **zero added source signatures**. Reviewed bd5 integration diff: Array.from fixes iterator target; W3 fixture now asserts catalog IDs/no legacy scalar. Historical original304 baseline and UserDashboard runtimeTaskStatus failure remain disclosed; neither excuses new failures.

## Closure / remaining verification

Stopped extra rounds per latest PM/user speed instruction. Full mounted modal/page/create save-and-read approval, new-language interaction, independent SDL execution, exhaustive Master/catalog-refetch/project-switch/concurrency combinations and deployed Chrome persistence remain **unverified here**. Retained Members/Report evidence consumed, not falsely claimed rerun. PM live Excel/picker observations are separate evidence.

Only own Temp tests/evidence and assigned primary report/manifests written. Own cache removed; **zero owned Node processes**. Shared node_modules, `.next`, NUL, source, PM authorities, DB, browser, release and other owners untouched. No commit/push/install/deploy. Ready to release reviewer slot.

Unresolved questions: none; remaining work is assigned implementation/verification, not a policy decision.
