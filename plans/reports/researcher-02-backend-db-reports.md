# Backend Report System & Database Schema Analysis

## Database Schema

### `reports` Table
Core report entity with metrics and period tracking.

**Structure:**
```
id (uuid, PK)                    # Auto-generated UUID
report_type (enum)               # Daily, Weekly, Monthly, Quarterly
report_date (date)               # When report generated
project_id (uuid, FK)            # Project reference (CASCADE DELETE)
plan_id (uuid, FK, NULL)         # Optional plan reference
period_start_date (date)         # Analysis period start
period_end_date (date)           # Analysis period end
total_tasks (int)                # Default 0
completed_tasks (int)            # Default 0
delayed_tasks (int)              # Default 0
on_schedule_tasks (int)          # Default 0
new_started_tasks (int)          # Default 0
total_bugs (int)                 # Default 0
critical_bugs (int)              # Default 0
major_bugs (int)                 # Default 0
minor_bugs (int)                 # Default 0
resolved_bugs (int)              # Default 0
unassigned_resources (jsonb)     # Resource tracking
summary (text)                   # Report summary text
created_at (timestamp)           # Auto: CURRENT_TIMESTAMP
updated_at (timestamp)           # Auto: CURRENT_TIMESTAMP
```

**Indexes:**
- PK: `id`
- `idx_reports_project` on `project_id`
- `idx_reports_type_date` on `(report_type, report_date)`
- UNIQUE: `(report_type, report_date, project_id)` - prevents duplicate reports

### `report_tasks` Table
Individual task snapshots within reports.

**Structure:**
```
id (uuid, PK)
report_id (uuid, FK)            # Reference reports (CASCADE DELETE)
task_id (uuid, FK)              # Reference tasks
task_title (varchar 255)        # Denormalized title
assignee_id (uuid, FK, NULL)    # User reference
planned_start_date (timestamp)  # Task plan dates
planned_end_date (timestamp)
actual_start_date (timestamp)   # Task execution dates
actual_end_date (timestamp)
status (task_status enum)       # See enum
is_delayed (bool)               # Default FALSE
delay_reason (text)             # Reason if delayed
remarks (text)                  # Additional notes
created_at (timestamp)          # Auto: CURRENT_TIMESTAMP
```

**Indexes:**
- PK: `id`
- `idx_report_tasks_report` on `report_id`
- `idx_report_tasks_task` on `task_id`

### `plans` Table
Plan data related to reports (optional reference).

**Key Fields:**
- `plan_id` (uuid, PK)
- `project_id` (uuid, FK) - ONE active per project (UNIQUE constraint where is_active=true)
- `plan_data` (jsonb) - Flexible data storage
- `is_active` (bool)

---

## Enum Definitions

### ReportType
```rust
Daily, Weekly, Monthly, Quarterly
```

### BugSeverity (local in reports.rs)
```rust
Critical, Major, Minor
```

### BugStatus (local in reports.rs)
```rust
Open, InProgress, Resolved, Closed
```

### TaskStatus (enums.rs)
```rust
Todo, Doing, Done, Close, Pending, Review, Blocked, Rejected, Archived
```

### ProjectRole (enums.rs) - For access control
```rust
Owner, Manager, Editor, Viewer
```

---

## Backend Implementation

### Report Model (`report.rs`)
Rust struct implementing `FromRow<PgRow>` for direct DB mapping.
- All 23 fields mapped from DB
- Serializable with Serde
- UTC timezone for timestamps

### Query Functions (`reports.rs`)
1. `get_report_by_id(pool, report_id)` → `Option<Report>`
2. `get_reports_by_project(pool, project_id)` → `Vec<Report>`
   - Orders by `created_at DESC`
   - No filter on report_type

---

## GraphQL Integration Status

**Findings:** Report GraphQL types/resolvers not yet found in standard locations. Need to verify:
- `src/graphql/types/` directory structure
- `src/graphql/resolvers/` for report resolver
- `schema.graphql` definitions

---

## Key Design Observations

1. **Immutable Snapshots:** `report_tasks` denormalizes data (task_title, dates, status) - reports capture point-in-time state
2. **Unique Constraint:** One report per project per day per type prevents duplicates
3. **Flexible Metrics:** 21 numeric columns cover tasks, bugs, resources
4. **Plan Integration:** Optional FK suggests reports can be tied to planning phase
5. **Role-Based Access:** ProjectRole enum enables Viewer/Editor/Manager/Owner differentiation

---

## Unresolved Questions

- GraphQL types/resolvers location and schema definition
- Report generation trigger mechanism (cron job, manual, event-driven?)
- How unassigned_resources JSONB structure is populated
- Access control enforcement layer for ProjectRole in resolver
