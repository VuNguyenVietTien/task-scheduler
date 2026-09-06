# PM Import Design 1 — Redmine Detailed Design (Issue 1115)

**Scope:** design-only / read-only. This proposal imports the 156 Redmine **task** tickets into the Rust/Postgres backend. It does not turn phase rows into schedulable tasks.

## Facts and import target

| Browser evidence | Import interpretation |
|---|---|
| `Detailed Design` has 179 descendants: 23 `tracker-Phase`, 156 `tracker-Task` | Persist **156 task records** and **23 non-task WBS group records**. |
| Layout is phase row followed by task rows | Retain display/order and containment in WBS group metadata. |
| Workflow-label counts: Create 69; Try-S Review 1 69; Address Review Comments 1 6; Try-S Review 2 6; Toshiba Review 6 | Required task-count validation: `69 + 69 + 6 + 6 + 6 = 156`. Labels are source workflow/stage data, not proof of a task's live status. |
| Root rollup 387h | Sum imported leaf `effort_hours` must equal `387.00` (decimal arithmetic). |
| Example #1139: 40h; Shuichi Nakayama; WBS row 5 | Manifest must show this mapping, including stable Redmine ID, effort, placeholder/member resolution, and source WBS position. |

Current schema has a `tasks.parent_task_id` self-reference and scalar `effort`, `start_date`, `due_date`, `category`, `assignee_id`, priority, and status. It has no external identity, WBS-group, dependency, or email-less-member representation. Current `project_members.user_id` is non-null and the member resolver accepts only an existing user found by email. Therefore this import needs a small relational import model rather than trying to overload current task fields or the `plans.plan_data` JSON snapshot.

## Phase ambiguity and recommendation

### Two possible readings

1. **Recommended — `Detailed Design` is the phase/category for every imported task.** The 23 immediate `tracker-Phase` children are WBS grouping metadata: they establish source ordering, display headers, and group rollups but are not task phase values and never become task rows.
2. **Alternative — each of the 23 Phase labels is the task phase value.** In this model `Detailed Design` is merely the Redmine parent/root. This flattens the source into 23 task categories and loses the distinction between the programme-level Detailed Design phase and the intermediate WBS containers unless both are separately stored.

Recommendation: use (1). The user clarification that **phase is a task attribute, never inserted as a schedulable task**, plus the browser indentation, supports storing the root programme phase on all 156 leaves while modeling the 23 rows separately as WBS groups. This preserves both dimensions: `task.phase = detailed-design`, `task.wbs_group = <one of 23 source rows>`. It also prevents phase headers from contaminating Gantt capacity, effort, and task counts.

**Decision needed from product owner:** confirm whether reporting/filtering should show all 156 as phase `Detailed Design`, or instead expose each of the 23 Redmine Phase labels as the task `phase`. The import must not run until this is confirmed, because changing it later changes category/phase analytics and user-visible filters. Also provide the canonical mapping/aliases for `Detailed Design` and for each of the 23 group labels (including locale labels if required).

## Proposed persistence model

Use an explicit source identity and WBS model. Names below are proposed migration targets, not existing tables.

### 1. Import run and source provenance

`external_import_runs`
- `import_run_id uuid`, `project_id`, `source_system` (`redmine`), `source_root_external_id` (`1115`), `mode` (`dry_run|apply`), `source_snapshot_sha256`, `started_at`, `finished_at`, `outcome`, `summary jsonb`, `error_count`.
- One immutable manifest per run. It enables reconciliation without retaining browser credentials or raw session material.

On `tasks`, add:
- `source_system text`, `external_id text`, `source_metadata jsonb`, `source_last_seen_at timestamptz`.
- Unique identity: `UNIQUE (project_id, source_system, external_id)` (or a partial unique index if non-imported rows retain null source fields).
- `source_metadata` holds only normalized, non-secret provenance, e.g. `{root_external_id, tracker, parent_external_id, wbs_group_external_id, wbs_path, wbs_row, source_url_or_key, raw_status, raw_priority, imported_fields_version}`. Never use it as the authoritative schedule model.

The external id must be Redmine's stable numeric issue ID as text—not title, position, or an inferred composite key. #1139 is thus deterministically upserted on every rerun.

### 2. Non-schedulable WBS groups

`wbs_groups`
- `wbs_group_id uuid`, `project_id`, `source_system`, `external_id`, `parent_group_id nullable`, `title`, `position`, `root_phase_key`, `source_metadata`, timestamps.
- `UNIQUE(project_id, source_system, external_id)` and `UNIQUE(project_id, parent_group_id, position)`.
- The 23 `tracker-Phase` nodes live here; no row is added to `tasks`; they cannot receive an assignee, effort allocation, prerequisite, or schedule bar.
- Use `tasks.wbs_group_id` FK to attach each imported leaf to its direct source group. This is necessary because `parent_task_id` cannot point to a non-task group.

### 3. Phase/category taxonomy

Use a project taxonomy table (or the approved existing taxonomy model) with immutable key + labels, rather than the web's hard-coded `TaskCategory` union.
- Seed/resolve `phase:detailed-design` for the recommended decision.
- Store task `phase_term_key = 'detailed-design'` (a dedicated column is clearer than overloading the current free-text `category`).
- Retain compatibility `category` as a derived/display value only during migration, if the frontend needs it. Do not map arbitrary group headings into the fixed frontend categories (`Frontend`, `Backend`, `Design`, `Testing`, `DevOps`).

### 4. Arbitrary real-task hierarchy

The observed source is only `phase → task`, so all 156 observed leaves have `parent_task_id = NULL` and `wbs_group_id` populated. The normalizer must nevertheless support arbitrary source depth:
- if a source parent is `tracker-Task`, upsert parent task first and set the child `parent_task_id` to the parent's local task ID;
- if a source parent is a phase/group, set `wbs_group_id`, not `parent_task_id`;
- retain ordered source path and sibling position for both kinds of node;
- reject cycles, a child whose parent is missing from the normalized snapshot, and cross-project parents before database write.

This lets future real task subtasks remain a task hierarchy without ever creating fake phase tasks.

### 5. Email-less assignees

Extend `project_members` to represent a human/project identity before an account exists:
- make `user_id` nullable;
- add `placeholder_key text`, `display_name text NOT NULL`, `source_system`, `external_id`, `metadata jsonb`;
- enforce a unique real user membership and a unique placeholder identity per project (e.g. partial unique indexes on `(project_id, user_id) WHERE user_id IS NOT NULL` and `(project_id, placeholder_key) WHERE placeholder_key IS NOT NULL`).

Because `tasks.assignee_id` currently references `users`, add `tasks.assignee_member_id → project_members.member_id`. Import assignments use that member reference; retain/synchronize legacy `assignee_id` only where the member is linked to a real user. Generate `placeholder_key` deterministically from normalized source identity, such as `redmine:assignee:<external-person-id>`; if no Redmine person ID exists, use a normalized name plus an explicit collision suffix recorded in the manifest. Never invent an email or user account.

Resolution order: exact source-person external ID → existing linked member source metadata → exact approved display-name alias → create placeholder. Name-only matches must be reported as `ambiguous_assignee`, not silently connected to a possibly wrong user. Later account linking must be explicit, atomic, and preserve the member ID so all imported assignments remain stable.

### 6. Prerequisites

Create `task_dependencies(predecessor_task_id, successor_task_id, dependency_type)` with unique pair and v1 type `finish_to_start`. Both ends must be imported task leaves in the same project; reject self-edges and cycles.

Build only when the required workflow nodes exist **within the same WBS scope/cycle** (never globally by matching title):

`Create → Try-S Review 1 → Address Review Comments 1 → Try-S Review 2 → Toshiba Review`

For a group/cycle that lacks an intermediate node, do **not** bridge across the missing node by default; emit `partial_workflow_chain` in the manifest. If the product owner intends skipped stages to be bridged (for example Create → Toshiba when review nodes are absent), expose an explicit `bridge_missing_workflow_stages` import option and record it in `source_metadata`. The observed count pattern (69/69/6/6/6) suggests six complete chains and additional Create/Review1-only work, but the extractor must supply group/cycle keys to prove pairing.

## Deterministic import pipeline

Implement as a Rust service/CLI/admin job behind an authorized internal trigger; it must not be a browser-driven write path.

1. **Receive a versioned extraction bundle.** Validate JSON schema, source `redmine`, root `1115`, snapshot hash, unique node IDs, known tracker type, WBS order, and no unknown parent. Preserve the raw downloadable bundle separately under controlled retention; persist only normalized provenance needed for audit.
2. **Normalize.** Convert external IDs to strings, trim/display-normalize names, parse effort as decimal hours, normalize dates to ISO timestamps with stated source timezone, classify node as `phase_group` or `task`, derive hierarchy/path, and resolve mapped status/priority/phase keys without heuristic title parsing.
3. **Preflight / dry run.** Resolve project, taxonomy, existing source records, WBS groups, assignees, and dependency candidates. No DML. Produce the manifest described below and stop on any blocking validation.
4. **Apply in one database transaction.** Lock the project/import-root advisory key; create run state; upsert WBS groups in parent-before-child order; upsert placeholders/members; then upsert tasks parent-before-child; resolve member assignments; replace/upsert only importer-managed dependency edges; calculate validation aggregates; mark run applied; commit. Any error rolls back all writes for this run.
5. **Reconcile / report.** Reread by `(project_id, source_system, external_id)`, emit final counts and errors, and mark source records seen. Do not delete local tasks absent from a partial extraction. A separate explicit `reconcile_missing` mode may soft-delete/archive only rows tagged with the same source root after confirmation and a complete-snapshot flag.

### Task field mapping

| Source field | Target / rule |
|---|---|
| Redmine issue ID | `tasks.external_id`; source `redmine`; unique per project/source |
| Root `Detailed Design` | `phase_term_key='detailed-design'` under recommended decision; preserve root ID in metadata |
| Immediate phase row | `wbs_groups` record and task `wbs_group_id`; never a task |
| Real task parent | `parent_task_id`, if and only if parent tracker is task |
| Subject/title, description | `title`, `description`; retain raw values/provenance in metadata if needed |
| Estimated hours | `effort_hours` / current effort compatibility field, decimal; source unit must be confirmed as hours |
| Assignee | `assignee_member_id`; existing user if unambiguous, else placeholder member without email |
| Redmine status | explicit configuration map to current status enum; unknown status is blocking |
| Redmine priority | explicit configuration map to current priority enum; unknown priority is blocking |
| Start/due dates | parsed `start_date` / `due_date`; absent remains null; invalid/mixed timezone values are blocking |
| Workflow label/stage | taxonomy/workflow metadata used for dependency matching; it must not overwrite true source status |
| Source order/WBS row | WBS group/task position plus `source_metadata.wbs_path` |

**Status and priority mapping requires a supplied mapping table.** The five browser workflow labels are not status values: they are counts by review-stage/task kind. Defaulting all tasks to TODO and priority MEDIUM may be permitted only as an explicit, visible import policy; it must be documented in the run manifest rather than silently inferred.

## Idempotency, duplicates, and updates

- Re-running the same bundle produces zero new task/group/member/dependency identities: `INSERT … ON CONFLICT … DO UPDATE` keyed by immutable source identity.
- The importer owns only its source-tagged fields. For changed source values, use a declared conflict policy: default `source_wins` for titles, source metadata, stage, source dates, effort, and source-derived hierarchy; **do not overwrite local status, local priority, manual dates, or assignee changes without a per-field policy/confirmation**. Report each conflict in dry run.
- Upsert dependencies by stable source-task pairs, scoped to this source root. Do not delete manually created dependencies.
- Keep a source checksum per task/group. If unchanged, skip update and report `unchanged`; if changed, report a field-level diff.
- Use PostgreSQL constraints and transaction locking, not an in-process “already imported” flag, so concurrent job retries cannot duplicate records.

## Dry-run manifest and validation gate

Dry-run writes a JSON and human-readable manifest (under the invoking job's artifacts, not browser storage) before any apply. Minimum contents:

```json
{
  "source": {"system": "redmine", "root_issue_id": "1115", "snapshot_sha256": "..."},
  "mode": "dry_run",
  "phase_policy": "root-detailed-design-for-all-tasks",
  "counts": {
    "source_phase_nodes": 23,
    "source_task_nodes": 156,
    "wbs_groups_create_update_unchanged": [0, 23, 0],
    "tasks_create_update_unchanged": [0, 156, 0],
    "workflow": {"create": 69, "try_s_review_1": 69, "comments_1": 6, "try_s_review_2": 6, "toshiba_review": 6},
    "dependencies_create_update_unchanged": [0, 0, 0],
    "placeholder_members_create_reuse": [0, 0]
  },
  "effort": {"source_hours": "387.00", "imported_leaf_hours": "387.00", "difference_hours": "0.00"},
  "sample": {"external_id": "1139", "effort_hours": "40.00", "assignee": "Shuichi Nakayama", "wbs_row": 5},
  "conflicts": [],
  "errors": [],
  "ready_to_apply": true
}
```

Hard validation failures:
- source counts differ from 23 phase groups / 156 tasks, or stage-count sum is not 156;
- leaf effort total is not exactly `387.00` after agreed decimal rounding;
- duplicate external ID in bundle, duplicate source identity already mapped to a different local project, missing/invalid parent, hierarchy cycle, or a phase proposed as a task;
- unknown taxonomy/status/priority mapping, invalid date, negative/non-numeric effort, unknown source unit, or unresolved required project/creator;
- dependency self-edge/cycle, cross-group pairing without an approved cycle key, or ambiguous assignee identity;
- any `INSERT` plan that would create an already-existing identity rather than use its upsert path.

Warnings (apply allowed only with explicit policy): missing assignee → placeholder; missing dates; no recognized dependency counterpart; absent optional description; source/local field conflict. The report must distinguish warning from error and include `external_id`, WBS path, field, source value, target value, action, and remediation.

## Transaction, rollback, and observability

- Use `SERIALIZABLE` (or a project-scoped advisory lock plus a defensible isolation level), validate after locks are acquired, and commit only after counts/rollup assertions pass.
- One failed task/group/member/dependency upsert rolls back the entire apply transaction. Persist a failed-run record only through a separate, minimal transaction after rollback, with no partially imported domain records.
- Never perform compensating row-by-row deletes as the primary rollback mechanism. For a committed bad source revision, run a new audited reconciliation/restore from the prior run manifest; only source-owned records are eligible.
- Record structured errors with import run ID, source ID/path, operation, SQL error class, and safe field context. Redact emails/tokens/raw authenticated URLs. Return a bounded error summary to GraphQL/CLI and retain detailed diagnostics server-side.
- Metrics: attempted/applied/failed runs, source nodes, inserted/updated/unchanged records, placeholders created, dependency edges, validation failures by code, transaction duration. Alert on effort/count mismatch.

## Browser extraction handoff (read-only boundary)

The browser/extraction worker should deliver a **static, versioned JSON bundle**, not credentials, cookies, session dumps, or an instruction to replay authenticated requests. Required fields per node:

```json
{
  "root": {"issue_id": "1115", "subject": "Detailed Design", "url": "redacted/stable-reference", "extracted_at": "ISO-8601", "timezone": "..."},
  "nodes": [{
    "issue_id": "1139", "parent_issue_id": "...", "tracker": "Task|Phase",
    "subject": "...", "description": "...", "position": 5, "wbs_path": ["..."],
    "estimated_hours": "40.00", "status": "...", "priority": "...",
    "assignee": {"external_id": "optional", "display_name": "Shuichi Nakayama"},
    "start_date": null, "due_date": null,
    "workflow_stage": "Create|Try-S Review 1|Address Review Comments 1|Try-S Review 2|Toshiba Review",
    "cycle_key": "explicit-or-null"
  }],
  "reported_rollup_hours": "387.00"
}
```

The extractor must also provide: complete descendant count, tracker counts, stage counts, stable sibling order, parent IDs for every node, and a SHA-256 checksum of canonicalized payload. It must label omitted/unavailable fields rather than fabricate them. In particular, it must supply a reliable `cycle_key` or explicit predecessor links before automatic workflow-chain creation; title matching alone is insufficient.

## Implementation acceptance criteria

1. A dry run of the approved #1115 bundle reports 23 groups, 156 task leaves, stage counts 69/69/6/6/6, and `387.00 == 387.00` leaf hours; #1139 reports 40h, Shuichi Nakayama resolution, and WBS row 5.
2. Apply creates no phase task, produces exactly 156 source-tagged tasks, attaches each to a non-schedulable WBS group, and assigns the selected phase policy.
3. A second identical apply produces no duplicate task/group/member/dependency identities and reports all unchanged.
4. A source task under another real task imports with `parent_task_id`; a source task under a phase imports with `wbs_group_id` only.
5. An assignee with no matching user is a placeholder member without email; an ambiguous name blocks rather than attaching to the wrong account.
6. Complete workflow chains gain FS edges in the required order; partial groups are reported and no implicit stage bridging occurs.
7. Any hard validation failure or write failure leaves no partial domain import. A final reconciliation query and manifest show the same identity/count/effort totals.

## Outstanding decisions

1. Confirm the recommended root-phase policy vs. using the 23 labels as task phase values.
2. Confirm Redmine effort unit and rounding rule; this design assumes estimated hours and exact decimal `387.00`.
3. Provide canonical status and priority mappings, timezone/date semantics, and whether source or local edits win on rerun.
4. Define the cycle key/predecessor data needed to pair workflow nodes safely and whether missing stages may be bridged.
5. Confirm whether placeholders may be created automatically for every unmatched assignee and the approved alias/collision-review process.
