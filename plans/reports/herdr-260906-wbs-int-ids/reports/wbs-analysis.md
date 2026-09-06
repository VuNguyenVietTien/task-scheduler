# WBS import analysis — 詳細設計工程・WBS

- Task: herdr-260906-wbs-int-ids (wbs-analysis)
- Mode: read/analyze only; no DB mutation, UI action, deploy, commit, delete; workbook untouched
- Artifacts written: `wbs-normalized.json`, `wbs-normalized.csv` (this directory)
- Deadline: 12 minutes; report complete

## 1. Sources

| File | Content |
| --- | --- |
| `/Users/TienVNV/Downloads/.com.google.Chrome.WD6Pp1` | XLSX (Microsoft Excel 2007+, 67 KB). Sheets: `WBS`, `選択肢` (hidden), `プロセス`. Extracted read-only via OOXML (zipfile + ElementTree; no openpyxl available, no workbook write). |
| `/Users/TienVNV/Downloads/.com.google.Chrome.L58TBu` | CSV (UTF-8 BOM, 22 KB) — same WBS exported, 182 lines = 182 sheet rows; dates as `2026/8/3` agree with XLSX serials (46237 = 2026-08-03). Used as cross-check only. |

Sheet `WBS` layout: row 1 title `詳細設計工程・WBS` + calendar serials; row 2 day-of-month band (8月/9月); row 3 headers `No | 成果物 | 作業 | 担当者 | 工数（時間） | 開始予定 | 完了予定 | 開始実績 | 完了実績 | ステータス` (cols 1–11); cols 12+ are Gantt calendar cells (ignored). Batch rows: `No` empty, `成果物` filled (e.g. `MST-02-02　材料基本情報マスタ`); work rows below inherit the current batch.

## 2. Exact counts

- **Batch rows: 23** (1 unnumbered `共通` + 22 coded `MST-02-xx`/`ETL-02-xx`).
- **Work rows: 156** (No values 2–179).
- **Skipped rows: 2** (sheet rows 1 and 3 — title and header bands; row 2 is calendar-only/auto-skipped as empty of data columns).
- **Missing `No` values (22):** 8, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94, 110, 117, 124, 131, 138, 145, 152, 159, 166, 173 — exactly one per coded batch header row; the source template numbers its batch rows, so numbering is contiguous, not data loss. (No `1` exists: the `共通` header carries no number.)
- Effort present on 39 rows, **total 387.0 h**; 117 review rows carry no effort (blank).
- Status: **完了/DONE 57, 進行中/DOING 11, blank/TODO 88**.

## 3. Hierarchical mapping (per task goal)

- **Project group / parent task** = batch row → `code` + `name_ja` (e.g. `MST-02-02` / `材料基本情報マスタ`; `共通` → code `COMMON`). Parent title recommendation: `MST-02-02　材料基本情報マスタ` (Japanese preserved verbatim, code kept for idempotency).
- **Child task** = work row → title `{doc_type}・{work_ja}` (e.g. `シーケンス図・作成`, `クラス仕様・Try-Sレビュー①`), under its batch parent.
- Column mapping: `工数（時間）`→`effort` (Float, hours); `開始予定`→`start_date`; `完了予定`→`due_date`; `ステータス`→status enum; `担当者` (SKG/Try-S/東芝/SKG・Try-S) → not system users → tags + description (see §6). `開始実績/完了実績` (actuals) retained in artifacts; backend has no actual-date field → recorded in description.
- Status mapping: `完了`→`DONE`, `進行中`→`DOING`, blank→`TODO`. Dates ISO 8601 (`2026-08-03`). All Japanese text preserved in artifacts.

## 4. Target project — ambiguity flagged

Default per instruction: **`b24aac96-4f0e-4689-8469-7222945b5df8` = "Codex E2E Production 2026-09-01"** (production E2E project from `docs/deployment.md`). **Ambiguity:** that project is an E2E test artifact, while this WBS is a Toshiba 詳細設計 deliverable set (SKG/Try-S/東芝 teams); no worksheet cell names a project, and no other existing project was evidenced in scope. Extraction continued with the default target recorded in `wbs-normalized.json` (`ambiguity_flagged: true`); confirm before import.

## 5. Backend/web capability check (read-only)

`backend/schema.graphql`: `create_task(input: CreateTaskInput!)` supports `project_id`, **`parent_task_id`** (exact 2-level hierarchy needed), `title`, `status: TaskStatus` (TODO/DOING/DONE/…), `start_date`, `due_date`, `effort: Float`, `type_`, `category`, `tags`, `assignee_resource_member_id`. Query `tasks(project_id:, status:)` returns existing tasks for duplicate detection. No dedicated bulk-import mutation exists → import = sequential `create_task` calls (parents first, then children with returned parent id), e.g. via `web/src/lib/taskApi.ts` `createTask` / `useTaskMutations`.

## 6. Import strategy (no duplicates)

1. Resolve/confirm target project id (§4).
2. Fetch `tasks(project_id: <id>)` once; build existing-title set.
3. For each of 23 batches: if parent title not present → `create_task` (status TODO, no dates); record id.
4. For each of 156 children: skip if `"{batch}｜{doc_type}・{work_ja}"` already present; else `create_task` with `parent_task_id`, mapped status, `effort`, `start_date`/`due_date` (planned), `tags: [assignee, doc_type]`, `type_: doc_type`, `category: batch code`, description carrying actual dates `実績: start–end` when present.
5. Idempotency key = composite title (batch code + doc type + work + No); re-running the same list is a no-op after step 2's check. Assignees stay as tags/description until real resource members exist (`resource_members(project_id:)`).

## 7. Rollback / risk

- Analysis-only: source files and workbook untouched; artifacts are new files in this directory; `rm` of the three files fully reverts. No DB writes performed. Import itself (§6) is a later, separately authorized step.

## 8. Remaining acceptance

- Human confirmation of target project (§4) before any import.
- 88 blank-status rows imported as TODO is a convention choice — confirm if blank should instead mean "not scheduled/skip".
