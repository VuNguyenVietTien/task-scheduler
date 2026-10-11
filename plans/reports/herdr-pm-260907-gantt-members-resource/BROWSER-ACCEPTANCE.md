# Released Chrome acceptance — pending deployment

Status: NOT RUN on new artifact. Earlier Chrome inspection reproduced the production defects; it is not acceptance of new source. Record final backend image/Git SHA and Vercel deployment before checking below.

Use Chrome profile Tien/browser2; rediscover current project tab (2026-09-07 17:20 tab1575513712 replaced earlier1575513680). Preserve user tabs and data. Prefer an explicitly named owned verification project or exact owned fixture subtree/member; never broadly delete project data. Track all created IDs and final retention/cleanup. No screenshots or tokens from unrelated tabs.

Additional baseline 17:20: actual project b24aac96-4f0e-4689-8469-7222945b5df8?tab=report Overview AX shows Total tasks24, Completed0, On schedule23, Late0, status TODO23/REJECTED1. Earlier same project List24rootrows and Gantt descendants confirmed. This is root-count mismatch evidence, not final correct task count or new-artifact acceptance. No browser mutation performed. Report aggregate owner needs all-depth distinct count audit and consistent status population.

| Check | Required observed result | Current result |
|---|---|---|
| Member UI | Exactly one add/manage section, name-only creation succeeds; new member visible after reload | Pending |
| Assignment | Normal and Excel selectors contain unlinked member; root and child set/clear survive edit-close and reload | Pending |
| Link | Link an eligible unlinked member to an existing account without changing member/resource handles or assignment/config; link alone grants no access | Pending; only use eligible owned fixture, never relink another person's account |
| Excel | Parent, children and grandchild all visible with readable depth, no duplicate rows | Pending |
| Clone tree | Button opens root/descendant checkboxes and quantity; root retained, unchecked subtree excluded | Pending |
| Clone quantity | Source6children, select3, qty3 ->3 new roots+9 children; each parent owns exactly selected3 after reload | Pending |
| Clone recovery | Integration tests cover committed/unknown/failed-refresh without blind duplicate retry; browser checks ordinary success/error UI | Pending |
| Gantt rows | One left task hierarchy and aligned timeline rows; collapse removes corresponding descendant rows only | Pending |
| Modes | WBS retains all-depth hierarchy/headings/priority; Master shows only configured progress phases and truthful unclassified allocations, no task rows | Pending |
| Positive hours | 10h fixture8+2 displays only8h and2h; task title remains left/tooltip, no task name inside day bar | Pending |
| Gaps | Weekend/nonworking leave and zero-allocation interruption show blank cells; positive resumed day shows segment | Pending |
| Dates | Start/End are first/last positive dates from selected plan; switching plan updates dates and matrix consistently | Pending |
| Matrix | All canonical MEMBER rows including unlinked/zero; daily assigned sum matches task vectors without parent rollup duplication | Pending |
| Capacity |8h baseline distinct from configured capacity/reservations; dayoff not false full-utilization; unknown history not fake0 | Pending |
| Alignment | Header, task grid and member matrix remain aligned during horizontal scrolling and date range changes | Pending |
| Collapse accounting | Collapse changes visible rows, not selected-plan member totals | Pending |
| Reorder | Manual sibling/subtree and auto priority sort preserve hidden slots, persisted hard reload; no reparent/drop on context headings | Pending |
| Plans | New/save/recalc/revision selection/Live and selected delete/set-active work on intended plan, persist after reload | Pending |
| Failure handling | Independent mounted tests prove authorization/concurrency/atomic rollback; browser records actionable errors rather than silent success | Pending |

Final evidence must distinguish actual Chrome observations, mounted database tests, component tests and unexecuted checks. Do not mark a check passed solely because a worker reported implementation.

| Settings tab | Visible project Settings tab, Progress type/Category/Task type isolated to current project | Pending |
| Bulk paste | Comma/newline paste splits into individual editable entries, trims blanks and reports invalid batch without partial save | Pending |
| Languages | Add a second locale label to same item, rename/order retain IDs and task assignment after reload; deterministic fallback | Pending |
| Task catalogs | Detail/create selectors use project stable catalog IDs; choose/clear each catalog and reload persists | Pending |
| Master catalog | Configured phase order/labels reflected, empty phase visible, positive actual hour cells summed once and gaps blank; saved plan IDs preserved | Pending |
| Counts | List/Report/Dashboard include descendants according to same authorized population; root pagination explicitly labeled | Pending |


19:25 Chrome current Vercel tab1575513724 deployment4sq9mp6eBBZcuiHSGLSon3wAbdC9 (45y1fx12r) BuildFailed6s. AX buildlogs: downloaded521files then Root Directory web does not exist. Cause deployment submission root flattenedweb while projectRootDirectoryweb retained. Vercelowner directed staging-only correction: submit parent containingweb/, retain projectsettings/source. Not an application compile failure. Backendpublicreadiness independently read ready/up/current19:24.


19:33 Own QA project created viaChrome:9fe2219a-1aeb-4328-8f4a-b3518229ac8d, QA release20260907, private. Retainidentifiedfixture. Userb24projectList now180total/24roots; Excelrendersdescendants. ClickAssigneecell focusesgeneric Excel cell input, no dropdown. No usertaskedit saved; normalAssigneeclickrepro only. Excelfollowupscopedforrepair.


19:47 Chrome own QA project Members loaded successfully after navigation. One add-member name/email section; existing linked owner, capacity/dayoff/group/commitment panels visible. No member/task/catalog write during this check. Existing profile Settings en/vi/ja buttons independently observed. Latest Excel/lang fixes pending new artifact; no claim livefix yet.
