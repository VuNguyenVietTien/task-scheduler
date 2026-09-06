# Sol / High Architecture Review — Vercel → Cloudflare → Rust → Local PostgreSQL

- **Date:** 2026-08-31
- **Mode:** read-only architecture audit; no source/config/deployment/database changes
- **Target:** Next.js on Vercel → Cloudflare-managed API subdomain → Rust/Actix on Ubuntu → PostgreSQL local to Ubuntu
- **Inputs:** `plans/reports/herdr-260831-0100-event-bridge-sol-review.md`; every report under `plans/reports/herdr-260830-2320-api-parity/reports/`; `docs/system-architecture.md`; current `web/` and `backend/` configuration/source; relevant migrations and route/screen wiring
- **Repository state:** branch `feat/vercel-supabase-migration`, heavily modified working tree. Findings describe the current working tree, not only committed HEAD.

## 0. Executive verdict

**Target architecture: sound. Current application: NO-GO for a full production cutover.**

A limited task-scheduler canary is achievable after the P0/P1 gates below, but the complete web product cannot yet move from the Vercel/Supabase execution path to the Rust backend because:

1. The active web Apollo client still calls same-origin Next.js Yoga at `/api/graphql`, obtains Supabase tokens, and executes Supabase-backed resolvers. It does not call the Cloudflare/Rust endpoint.
2. Rust GraphQL has task/project/member/comment/plan/notification operations, but no design-document or report root surface. Full `/designs/**`, project Documents, and project Report screens therefore have no Rust target.
3. Production boot/deployment configuration is internally inconsistent: `Config` requires variables absent from the examples/Compose file; Compose/Docker set `HOST`/`PORT` while Rust reads `SERVER_HOST`/`SERVER_PORT`; default bind is loopback inside the container; no executable migration runner is present despite README instructions.
4. Public security blockers remain: credentialed wildcard CORS, fail-open Next middleware, mixed unverified cookie assumptions, public upload/path handling, excessive request/response logging, and a tracked credential-like file that is not excluded from the backend Docker build context.
5. Supabase is still a runtime dependency for auth, middleware, GraphQL context/resolvers, Realtime hooks, and Storage. It cannot be removed by only deleting environment variables.
6. The existing Rust `/ws` is an unauthenticated echo socket, not a replacement for Supabase Realtime; the web does not consume it.
7. Several create→display paths have concrete contract defects, including project-create response navigation and task progress enum casing.

**Recommended destination:** Vercel serves UI only; browser calls `https://api.<domain>` through Cloudflare; Rust is the sole application API; Firebase remains the identity provider initially; local PostgreSQL is the sole application database; Supabase runtime dependencies are retired after a verified migration/soak period. Use bearer Firebase ID tokens first to avoid third-party-cookie and CSRF complexity. Add an HttpOnly app-session cookie only if a same-origin BFF is deliberately selected.

---

## 1. Observed architecture vs requested target

### 1.1 Current working-tree architecture

```text
Browser
  ├─ Next pages on Vercel
  ├─ Apollo → same-origin /api/graphql
  │    └─ Next GraphQL Yoga → Supabase Auth + service-role DB access
  ├─ Next /api/** routes → Supabase DB/Auth/Storage
  ├─ Supabase Realtime browser channels
  ├─ Firebase Auth + FCM
  └─ selected legacy paths → NEXT_PUBLIC_BACKEND_URL / Rust

Rust backend
  ├─ /graphql: task scheduler GraphQL
  ├─ /api/v1/auth/**: mixed Supabase/Firebase/legacy JWT auth
  ├─ /media/**: local filesystem uploads
  ├─ /ws: unauthenticated echo socket
  └─ PostgreSQL via SQLx
```

Evidence:

- Active provider uses `web/src/lib/apollo-client.ts`, whose URI is `/api/graphql`; `web/src/providers/ClientProviders.tsx` mounts that client.
- `web/src/app/api/graphql/route.ts` mounts Yoga with Supabase context from `web/src/lib/graphql/context.ts`.
- `web/src/middleware.ts` refreshes Supabase sessions and accepts a custom-cookie pair as fallback.
- Supabase-backed API routes and services remain across auth, projects, tasks, comments, attachments, notifications, designs, and media.
- `backend/src/main.rs` independently mounts `/graphql`, `/ws`, and `routes::config`.

`docs/system-architecture.md` describes the Vercel + Supabase unified backend as the replacement architecture. The requested direction reverses that decision. The document is therefore stale for this target and must be updated only after architecture acceptance.

### 1.2 Recommended target topology

```text
Browser
  │ HTTPS / WSS
  ├──────────────→ app.example.com
  │                 Vercel: Next.js UI only
  │                 - static/RSC rendering
  │                 - no business-data Yoga resolvers
  │                 - no Supabase service role
  │
  └──────────────→ api.example.com
                    Cloudflare DNS/proxy/WAF/rate limits
                    - TLS at edge
                    - cache bypass for API/auth/ws
                    - WebSocket enabled
                         │ TLS Full (Strict) or Cloudflare Tunnel
                         ▼
                    Ubuntu reverse proxy (Caddy/Nginx)
                    - :443 only or private Tunnel
                    - /graphql, /api/**, /media/**, /ws
                         ▼
                    Rust/Actix service on 127.0.0.1:8080
                         │ Unix socket or localhost TCP
                         ▼
                    PostgreSQL on localhost/private socket
                    - no public :5432
                    - app and migration roles separated
```

### 1.3 Domain decision

Preferred production domains:

- `app.example.com` → Vercel custom domain
- `api.example.com` → Cloudflare proxied Ubuntu origin

These are **cross-origin but same-site** when both use HTTPS. This makes host-only API cookies possible with `SameSite=Lax`, but CORS is still required. Do not rely on an app at `*.vercel.app` talking cookie-auth to `api.example.com`; that is cross-site and increasingly blocked as third-party-cookie behavior even with `SameSite=None`.

Cloudflare origin choices:

1. **Preferred:** Cloudflare Tunnel to the Ubuntu reverse proxy; no public origin port.
2. **Acceptable:** proxied DNS to a static IP, TLS Full (Strict) with an Origin CA/public certificate, firewall allowing only Cloudflare ingress, ports 8080/5432 closed publicly.

Cloudflare must bypass caching for `/graphql`, `/api/*`, `/ws`, authenticated media, and every response carrying `Set-Cookie`.

---

## 2. Required component boundary

### Next.js / Vercel owns

- UI routing, rendering, static assets, localization.
- Firebase browser SDK for sign-in and ID-token refresh during the initial cutover.
- Apollo client configured to `https://api.example.com/graphql`.
- Optional same-origin thin proxy only if explicitly choosing a BFF; do not retain duplicate business resolvers.

### Rust / Ubuntu owns

- All authorization decisions and app identity mapping.
- GraphQL/REST business APIs.
- Validation, transaction boundaries, audit events, uploads, realtime event production.
- PostgreSQL access; browser never receives DB credentials or service-role access.

### PostgreSQL owns

- Core task scheduler, reports, and design-document records.
- Referential integrity and migration history.
- Transactional outbox if realtime is required.

### Firebase owns initially

- Google/email identity and FCM delivery.
- Firebase ID tokens are verified by Rust. Firebase UID/email map to `users.user_id`.

### Supabase owns after cutover

- **Nothing in steady state**, unless the team explicitly chooses to retain Supabase Storage temporarily. Compatibility code may remain disabled for one release, then be removed.

---

## 3. Current production blockers

| Severity | Finding | Evidence / consequence | Gate |
|---|---|---|---|
| P0 | Active UI still targets Next Yoga/Supabase | `web/src/lib/apollo-client.ts`, `/api/graphql`, Supabase auth middleware | Switch endpoint/auth only after Rust parity tests pass |
| P0 | Rust missing design/report GraphQL roots | `backend/schema.graphql` has no systems/modules/documents/screens/components/flows/tags/reports roots | Port domains or keep an explicitly routed Rust service/gateway |
| P0 | Credential-like tracked artifact enters Docker context | `git ls-files` reports `backend/config/firebase-service-account.json.key`; `backend/.dockerignore` does not exclude `config/**` or `*.key`; Dockerfile uses `COPY . .` | Remove from history/build context and rotate/revoke associated credential before any image build |
| P0 | Credentialed wildcard CORS | `backend/src/main.rs`: `allow_any_origin().supports_credentials()` | Exact origin allowlist + tests |
| P0 | Backend config cannot follow supplied deployment files | `Config::from_env` requires DB, Redis, auth, JWT, SMTP values; `.env.example`/Compose omit several. Rust reads `SERVER_*`, deployment files set `HOST`/`PORT` | One validated env contract and startup test |
| P0 | Container bind mismatch | default `SERVER_HOST=127.0.0.1`; Docker sets unused `HOST=0.0.0.0` | Bind correctly inside container or run host binary behind local proxy |
| P0 | No reliable migration command | README says `cargo run --bin migrate`; no migration binary/source invocation found | Add/version migration runner and migration-status gate |
| P0 | Upload surface unsafe for public use | unauthenticated route; MIME header trust; reads whole file; arbitrary path composition on reads; SVG served inline; local file/data lifecycle not transactional | Replace/harden before public exposure |
| P1 | GraphQL logs queries, variables, full responses | `backend/src/graphql/handlers.rs`; can record personal/project data | Structured redacted logs; no payloads in production |
| P1 | No readiness/liveness/migration health endpoint | none mounted | Add health gates for proxy/systemd/deploy |
| P1 | Next build suppresses type and lint failures | `web/next.config.mjs` ignores TypeScript and ESLint build errors | Remove suppression before release gate |
| P1 | Docker base/config drift | Rust 1.70 + Debian bullseye/libssl1.1; Cargo lock ignored; web Docker expects standalone while Next config disables it | Reproducible supported toolchains/images |
| P1 | Next middleware fails open | Supabase error or missing env permits protected routes; cookie presence accepted without verification | UI middleware is convenience only; API enforces auth; replace/remove fail-open logic |
| P1 | GraphiQL exposed on production GET `/graphql` | `backend/src/main.rs` | Disable or admin-gate in production |
| P1 | Filesystem logging and service-account file startup coupling | `backend/src/main.rs` writes `backend.log` and loads a fixed JSON path | stdout/journald; inject secret through protected runtime mechanism |

---

## 4. Supabase dependency disposition

Supabase is not one dependency; it currently spans five planes. Removal must be coordinated.

| Plane | Current dependencies | Target action |
|---|---|---|
| Auth | `@supabase/ssr`, `@supabase/supabase-js`; `authApi.ts`; middleware session refresh; browser OTP verification; Next auth routes; Rust Admin/JWT compatibility | **Replace** with Firebase ID-token bearer flow to Rust. Keep Rust Supabase verification/Admin support disabled for one compatibility release, then remove. |
| DB/data API | Next GraphQL context, service modules, design resolvers, API routes use Supabase clients/service role | **Replace** with Rust SQLx resolvers against local PostgreSQL. No service-role credential on Vercel after cutover. |
| GraphQL execution | Next Yoga merges task and design schemas | **Remove** as business API after Rust parity. Keep only a deliberate proxy if needed, not duplicate logic. |
| Realtime | task, notification, and document hooks subscribe to Supabase Postgres Changes/Presence | **Replace** with refetch first; later authenticated Rust WS/SSE + transactional outbox. Current hooks appear defined but not consumed by screens. |
| Storage | `/api/media/upload` writes to Supabase Storage | **Replace** with Cloudflare R2 or hardened Ubuntu object volume. R2 is preferred for durability/CDN and avoids coupling uploads to app releases. |
| SSR middleware | `web/src/middleware.ts`, `lib/supabase/middleware.ts` | **Remove/replace** with UI-only route gating based on Firebase state; Rust remains authoritative. |
| Generated types/env | Supabase DB types and `NEXT_PUBLIC_SUPABASE_*`, service-role env | Remove after final deployment no longer imports them. |
| Packages | `@supabase/ssr`, `@supabase/supabase-js` | Remove only after import scan and production soak show zero runtime use. |

### Coordinated removal order

1. Implement complete Rust contract and local DB schema.
2. Change Apollo/auth/realtime/upload consumers behind deployment flags.
3. Run parity/E2E against Rust while Supabase remains rollback-read-only.
4. Cut over writes once.
5. Soak and reconcile counts/checksums.
6. Remove Vercel service-role credentials and Supabase runtime imports.
7. Remove Rust Supabase compatibility modules/config in a later release.

Simply unsetting Supabase variables now breaks active Apollo context, middleware, login session establishment, design/report resolvers, realtime, and Storage.

---

## 5. Auth, CORS, cookies, and CSRF

### 5.1 Recommended browser auth: Firebase bearer, no application auth cookie

The lowest-risk transition is:

1. Firebase browser SDK signs in and refreshes ID tokens.
2. Browser calls Rust `/api/v1/auth/firebase/login` once to verify identity/upsert the local `users` row.
3. Apollo calls `getIdToken()` and sends `Authorization: Bearer <Firebase ID token>` to `https://api.example.com/graphql`.
4. Rust GraphQL verifies Firebase signature/audience/issuer, requires verified email where policy demands it, and resolves the current `users.user_id`.
5. Existing legacy Rust JWT remains temporarily for mobile; remove issuer ambiguity after client migration.

Benefits: no third-party-cookie dependence, no CSRF on bearer-auth APIs, Firebase handles token refresh, and Supabase Auth can be removed.

Current blockers for this flow:

- Active Apollo obtains a Supabase session token.
- Rust GraphQL `resolve_bearer_claims` handles Supabase/legacy JWT but not Firebase; Firebase fallback exists in selected REST auth handlers only.
- `resend_verification` still uses the dual JWT resolver without Firebase fallback.
- Current `/firebase/login` stores a raw Firebase ID token in a 24-hour cookie although Firebase ID tokens are shorter-lived.

### 5.2 If cookie sessions are selected instead

Use a backend-minted application session, not a raw Firebase token:

- Cookie: `__Host-pm_session`; `Secure; HttpOnly; Path=/`; no `Domain`.
- Production app/API custom domains: `SameSite=Lax` is sufficient for same-site cross-origin requests; fetch still requires `credentials: 'include'` and explicit CORS.
- Vercel default domain to custom API: `SameSite=None; Secure` is required but remains unreliable due third-party-cookie blocking. Avoid this topology.
- Rotate short-lived access sessions and refresh tokens; hash/store refresh-token families and revoke on logout.
- Cookie clear responses must use matching name/host/path.
- Never set `Domain=.example.com` unless the browser must send the cookie to multiple hosts; host-only is safer.

Cookie-auth mutations require CSRF protection:

- exact `Origin`/`Host` validation,
- explicit CSRF token or double-submit header for state-changing REST/GraphQL operations,
- reject simple cross-site content types,
- no GET mutations.

### 5.3 CORS target

For bearer-first production:

- Allowed origins: exact `https://app.example.com` plus a separate exact staging origin.
- Methods: `GET, POST, OPTIONS` plus only required upload methods.
- Headers: `Authorization, Content-Type, X-Request-ID` and explicit CSRF header only if cookie auth exists.
- Credentials: omit unless cookies are deliberately used.
- Vary: `Origin`.
- Reject untrusted origins in integration tests.

Do not permit wildcard Vercel previews against production credentials. Preview builds should use an isolated staging backend or bearer-only, explicitly registered preview origins with expiry.

### 5.4 Cloudflare auth controls

- Rate-limit login, refresh, password-reset, upload, and expensive GraphQL operations.
- Disable edge caching for auth/API.
- Forward original client IP safely; trust proxy headers only from Cloudflare/reverse proxy.
- Add GraphQL depth/complexity/body-size limits and persisted operations if public abuse becomes material.

---

## 6. Realtime, WebSocket, notifications, and uploads

### 6.1 Current state

- Supabase hooks subscribe to task updates, notification inserts, and document updates/presence.
- No screen import/consumer of those `useRealtime*` hooks was found in the scoped source search, so “Realtime implemented” is not equivalent to an active create→display path.
- Rust `/ws` has no authentication or user subscription protocol. Its stream handler echoes text/binary; each connection creates its own connection list; no durable replay or domain-event wiring is present.
- FCM remains separately wired, but client notification code contains configuration drift and operation-name drift. Treat push as an independent feature gate.

### 6.2 Recommended phases

**Phase R0 — cutover:** mutation response + Apollo cache/refetch. Poll notification count if required. Do not block API migration on realtime.

**Phase R1 — server events:**

- Insert an event into a PostgreSQL transactional outbox in the same transaction as task/comment/notification changes.
- A Rust dispatcher reads unpublished events and broadcasts normalized events.
- Authenticated client channels are scoped to user/project authorization.
- Include monotonic event IDs/cursors, reconnect backoff, heartbeat, and resume/reconciliation query.
- For one Rust instance, in-process broadcast is acceptable only after the outbox guarantees recovery. Multi-instance deployment needs a shared fanout layer or PostgreSQL LISTEN/NOTIFY plus outbox.

**Browser WS authentication:** native WebSocket cannot set an Authorization header reliably. With bearer-first auth, obtain a short-lived, single-use WebSocket ticket over authenticated HTTPS, then connect to `wss://api.example.com/ws?ticket=...`. Never put reusable ID/JWT tokens in URLs.

Cloudflare and reverse proxy must support `Upgrade`/`Connection`, long idle timeouts, ping/pong, and no buffering/cache on `/ws`.

### 6.3 Upload target

Preferred: Rust issues an authorized upload intent to Cloudflare R2, validates metadata, and stores an attachment record in PostgreSQL. Alternative: a dedicated Ubuntu volume outside the release directory with off-host backup.

Required controls before public use:

- authenticated project/task authorization,
- server-enforced body/file count/size limits at Cloudflare, proxy, and Rust,
- streaming writes rather than whole-file buffering,
- random server names; never trust client paths/extensions,
- magic-byte/MIME validation,
- reject or sanitize SVG; serve untrusted active content with safe headers/origin,
- atomic write/finalize and cleanup on DB failure,
- attachment ownership metadata and soft-delete lifecycle,
- signed/private URLs where files are not public,
- malware scanning if user population is untrusted,
- backup/restore and orphan reconciliation.

The current GraphQL upload mutation is a demo that writes dummy bytes and no DB row; it must not be used as evidence of upload completion.

---

## 7. PostgreSQL architecture and performance

### 7.1 Deployment posture

- PostgreSQL 15+ on Ubuntu, bound to localhost/private socket only.
- Separate roles: migration owner, application role, backup/monitor role; app role is not superuser and cannot alter schema.
- SCRAM authentication; encrypted off-host backups; restore drills.
- Enable `pg_stat_statements`; set a slow-statement threshold; monitor locks, pool waits, autovacuum, bloat, disk, replication/backup age.
- Explicit `statement_timeout`, `lock_timeout`, and `idle_in_transaction_session_timeout`.
- One Rust process can use a direct SQLx pool. PgBouncer is optional until multiple service instances/pools justify it.

### 7.2 Pool findings

- `backend/src/db/mod.rs::create_pool` configures max 5/acquire timeout 3s, but `backend/src/main.rs` bypasses it with `PgPool::connect`, so the intended pool policy is unused.
- `DB_MAX_CONNECTIONS` and `DB_CONNECT_TIMEOUT` in config are also unused.
- Configure min/max/acquire/connect/idle/max-lifetime through validated env and expose pool wait metrics.
- Budget connections across task backend, design service, migrations, monitoring, and admin sessions rather than per-process guesswork.

### 7.3 Query/index findings

Existing single-column FK indexes are a useful baseline, but hot query shapes need composite/partial indexes verified with `EXPLAIN (ANALYZE, BUFFERS)` on production-like volume:

- `tasks(project_id, priority_order) WHERE is_deleted=false`
- `tasks(project_id, status) WHERE is_deleted=false`
- `tasks(project_id, assignee_id) WHERE is_deleted=false`
- `tasks(parent_task_id, priority_order) WHERE is_deleted=false`
- `comments(task_id, created_at) WHERE is_deleted=false`
- `notifications(user_id, is_read, created_at DESC)`
- `plans(project_id, updated_at DESC)`; retain the partial unique active-plan index
- report lookup index beginning with `project_id` and matching report type/period predicates
- design child ordering indexes such as `(system_id, sort_order)`, `(module_id, created_at)`, `(document_id, sort_order)`, `(screen_id, sort_order)` where queries order that way

Do not add all indexes blindly; capture actual plans first. The explicit `users(email)` and `users(username)` indexes duplicate indexes already created by UNIQUE constraints and should be evaluated for removal.

### 7.4 Scale/correctness risks

- `tasks` uses an unbounded recursive CTE and returns every matching task with no pagination. Add cycle prevention/detection, depth limits, statement timeout, and paginated project/task APIs.
- `projects` and several list resolvers use `fetch_all` without server pagination. The UI currently paginates only after loading all tasks.
- `tasks_paginated` exists in web operations but not Rust SDL.
- Current custom DataLoader caches globally for process lifetime, is stale/unbounded, and `load_one` does not batch. Use request-scoped async-graphql DataLoader or explicit joined/batched queries.
- Reorder performs one UPDATE per item inside a transaction; batch with `VALUES`/`unnest`, lock affected rows deterministically, and enforce project ownership.
- Parent task relationships permit logical cycles unless application checks are complete.
- Design SVG and layer JSON can become large TOAST values; cap payload size, avoid returning full SVG in list queries, and monitor table/bloat/backup growth.
- Audit triggers depend on `app.user_id`; Rust transactions must `SET LOCAL` that value or audit attribution defaults incorrectly.

### 7.5 Migration integrity

Backend migrations and `web/supabase/migrations/00001_initial_schema.sql` are not equivalent: the Supabase baseline also includes reports, design tables, audit triggers/indexes, and Realtime publication changes. The local target needs one authoritative migration chain. Do not apply both overlapping baselines to the same database.

Create a reconciled local baseline or forward-only bridge migrations, then test from:

1. empty database,
2. current backend database,
3. restored Supabase public-schema snapshot.

The uppercase task enum migration touches multiple dependent tables and must be tested against each real source state.

---

## 8. Seed strategy

No production-ready seed command was found. `backend/src/tests/testdata.json` is test data, not an environment seed contract.

### 8.1 Seed policy

- Version seeds independently from schema migrations.
- Migrations create structure; seeds create non-production fixtures.
- Seed runner refuses to run when `APP_ENV=production` or the DB name/allowlist does not identify an approved dev/E2E database.
- Acquire a PostgreSQL advisory lock and run in one transaction where possible.
- Use deterministic UUIDs and `INSERT ... ON CONFLICT ... DO UPDATE`; tag fixtures with a stable namespace/run marker.
- Never truncate shared/staging data.
- Never seed secrets, Firebase service accounts, real FCM tokens, or production emails.

### 8.2 Dependency order

1. Identity fixtures: manager, leader, member, guest; deterministic `users.user_id`, unique email/username, Firebase emulator UID mapping.
2. Projects and owner membership.
3. Additional memberships/roles.
4. Plans and report fixtures.
5. Root tasks, then subtasks; cover every task status/priority/progress type.
6. Comments, mentions, notifications, status history.
7. Design system → modules → documents → screens → components → mappings → flows/steps → design tags/links/audit.
8. Upload fixture metadata and a separately provisioned test object; do not embed credential material.

### 8.3 Auth fixtures

- Local/E2E: seed Firebase Auth Emulator users with fixed UIDs and seed matching local `users` rows.
- Staging against real Firebase: pre-provision dedicated non-human test users through a secure CI setup step; store credentials only in the CI secret store.
- Production: no user/content seed. Bootstrap the first administrator through an audited one-time command or explicit role update after verified login.

### 8.4 Seed acceptance

Run twice with identical row counts and IDs; validate all FKs; then execute the create→display matrix with a unique run suffix and delete only rows carrying that test-run marker.

---

## 9. Screen-by-screen create → display E2E matrix

Status reflects the current tree against the requested Rust target.

| Screen / route | Create/change action | Persistence/API expected | Display assertion | Auth/role | Current target status |
|---|---|---|---|---|---|
| `/` | none; redirect | none | lands on `/dashboard` | any | Ready as UI redirect |
| `/auth` | Firebase email/Google sign-in; app-user upsert | Firebase → Rust `/api/v1/auth/firebase/login` → `users` | `/me` returns same `users.user_id`; dashboard name shown | authenticated user | **Blocked:** web calls same-origin Next route and establishes Supabase OTP/session; no visible registration flow; target token wiring incomplete |
| `/dashboard` | create/update a task elsewhere | Rust `create_task`/`update_task*` → `tasks` | `tasks(assignee_id)` shows card in correct PM/member group | member/manager | **Blocked:** Apollo endpoint/auth switch; task-create enum defect; no active realtime consumer |
| `/projects` | create via `/projects/new` | `create_project` transaction → `projects` + owner `project_members` | `projects` list contains exact name/status/member count | authenticated; owner | **Fail:** mutation asks `create_project`, but page reads `data.createProject.projectId` instead of snake response, so post-create navigation is broken |
| `/projects/new` | project with tags/status/priority/visibility | same as above | redirect to `/projects/{project_id}`, then list/detail query matches input | authenticated | **Fail** until response-key/navigation contract fixed and tested |
| `/projects/{id}?tab=list` | add task | `create_task` → `tasks`; query `tasks(project_id)` | task appears in list with fields and assignee | project member; create policy explicit | **Fail:** form uppercases lowercase `progress_type`, while Rust contract keeps TaskProgressType lowercase; also no server pagination |
| `/projects/{id}?tab=kanban` | drag status/order | `update_task_status` / `reorder_tasks` | card moves and remains after reload | authorized member | **Blocked:** dormant REST/GraphQL paths coexist; `reorder_tasks` Rust return `[Task!]` differs from web Boolean contract in known parity register |
| `/projects/{id}?tab=gantt` | create/update/activate plan and task dates | plan mutations → `plans`; task date updates → `tasks` | refreshed timeline uses active plan and persisted dates | manager/leader | **Partial:** dual plan aliases exist; `plan_data` shape mismatch remains; E2E required |
| `/projects/{id}?tab=members` | add by email, update role/position, bulk remove | `project_members` | member list and `my_project_role` reflect change | manager/leader | **Blocked:** known `invite_project_member`, input-object, and position contract gaps remain |
| `/projects/{id}?tab=report` | create/update/delete report | `reports`, `report_tasks`, `bugs`, status history | period metrics and selected plan render after reload | project reader; write role explicit | **Blocked:** Rust SDL has no report roots despite DB modules/migrations |
| `/projects/{id}?tab=documents` | create design system/document | design tables | project-scoped systems/documents render | project member | **Blocked:** Rust task backend has no design roots; must port or route design-doc Rust service |
| `/projects/{id}/add-task` | create root task | `create_task` → `tasks(parent_task_id NULL)` | project list + dashboard + direct task query show it | project member | **Fail** on current progress enum conversion; start-date construction also needs browser E2E verification |
| `/projects/{id}/tasks/{taskId}` | edit title/description/status/effort/assignee; create/delete comment; upload image | task mutations; `comments`; media/object store | reload shows updates; comment response/query fields match; media URL survives new session | task/project member | **Partial:** core GraphQL parity mostly accepted; upload is unsafe/non-durable; Assignee.full_name population remains incomplete; mixed Redux/Apollo paths need one E2E |
| `/projects/{id}/tasks/{taskId}/create-subtask` | create child task | `create_task(parent_task_id)` | parent `task_subtasks` and project tree show child | project member | **Fail** on same task enum issue; test parent/project authorization and cycle rules |
| `/designs` | create system | `createSystem` → `systems` | `systems(projectId)` shows system | project member | **Blocked:** hardcoded `projectId='1'`; camel design op exists only in Next Yoga/design service, not task Rust SDL |
| `/designs/{systemId}` | create module and document | `modules`, `design_documents` | `system(id)` returns nested module/document | project member | **Blocked:** no target Rust roots |
| `/designs/{systemId}/{moduleId}/{documentId}` | create screen | `screens` | `designDocument(id)` shows screen and flow list | project member/editor | **Blocked:** no target Rust roots |
| `/designs/.../screens/{screenId}` | paste/replace/clear SVG; create/update component/mapping/tag | `screens`, `components`, `field_mappings`, tags, audit | viewer survives reload; sanitized SVG/layers/components match | design editor | **Blocked:** no target Rust roots; payload/XSS/size/realtime controls required |
| Global notifications UI | task/comment creates notification; mark read | `notifications`, FCM token storage | dropdown/count and reload agree; FCM optional | authenticated recipient | **Partial:** Rust roots exist; operation-name drift exists in legacy notification service; Supabase hook not actively wired; FCM must be independently tested |
| Rich-text/media path | attach image while editing task/comment | authorized upload → R2/local object + `attachments` | persisted HTML uses durable HTTPS URL and remains after cache/session reset | project member | **Blocked:** multiple competing upload implementations; current Rust route/public serving is not production-safe |

### Mandatory E2E evidence per row

Each test must capture:

1. network request operation/path and status,
2. returned canonical ID,
3. direct persistence assertion through a test-only DB verifier or API query,
4. hard reload/new browser context display assertion,
5. second-role authorization assertion,
6. forbidden-user negative assertion,
7. realtime assertion only where the feature promises realtime,
8. cleanup by test-run marker.

No Playwright/E2E script or E2E npm command is currently declared in `web/package.json`; this matrix must become executable before cutover.

---

## 10. Deployment sequence and gates

### Phase A — architecture/security freeze

1. Decide custom domains, bearer vs cookie auth, and design/report service strategy.
2. Remove credential material from source/build context and rotate affected credentials.
3. Freeze GraphQL/API contracts from actual web operations; add schema contract tests for every active operation.
4. Disable Next build-error suppression.

**Gate A:** clean secret scan; reproducible web/backend builds; contract diff approved; no P0 security item open.

### Phase B — PostgreSQL preparation

1. Provision Ubuntu PostgreSQL roles, localhost binding, backup storage, monitoring.
2. Reconcile one authoritative migration chain including task, report, and design tables.
3. Restore a production-shaped snapshot into staging; run migrations; `ANALYZE`.
4. Validate enum values, FK orphans, row counts, sampled checksums, and query plans.
5. Rehearse encrypted backup restore and record RTO/RPO.

**Gate B:** empty/current/restored-source migration tests pass; rollback/restore drill passes; no orphaned identities; hot queries meet budgets.

### Phase C — Rust service readiness

1. Normalize env names and startup validation; configure SQLx pool explicitly.
2. Add health/readiness, graceful shutdown, redacted structured logs, request IDs, metrics.
3. Complete report/design API parity or route an explicitly supported second Rust service behind the same API hostname.
4. Implement final auth, exact CORS, API limits, upload strategy, and optional realtime phase.
5. Build a pinned release artifact/container without credential files.
6. Run contract, integration, seed, and E2E matrix locally/staging.

**Gate C:** Rust passes 100% active web operation contracts and required screen matrix; untrusted origin rejected; unauthorized roles rejected; upload/realtime tests pass where enabled.

### Phase D — Ubuntu + Cloudflare

1. Install release under a dedicated unprivileged system user.
2. Store secrets in a root-owned environment/secret mechanism (`0600`), never in image/repo.
3. Run Rust via systemd on loopback; reverse proxy/Tunnel only.
4. Configure Cloudflare DNS/Tunnel, Full (Strict), WAF/rate limits, cache bypass, body limits, WebSocket route.
5. Smoke `/health/live`, `/health/ready`, auth, GraphQL, media, and WS if enabled.

**Gate D:** origin not directly reachable; 5432/8080 closed; TLS valid; readiness removes unhealthy release; logs/metrics/alerts visible.

### Phase E — Vercel preview and canary

1. Deploy Vercel preview using staging API URL and Firebase config; no Supabase service role.
2. Run the full matrix against staging.
3. Deploy production UI with a feature flag/API base that can select Rust.
4. Canary internal users; compare errors, latency, auth failures, and data results with the old read path.

**Gate E:** zero unexplained parity differences; error/latency budgets met; no writes to two authorities.

### Phase F — data cutover

1. Enter a short maintenance/read-only window on the old write path.
2. Take final backup/export and copy final delta, including design data and object metadata.
3. Verify counts/checksums and identity mappings.
4. Enable Rust writes, switch Vercel production API base, then exit maintenance.
5. Monitor intensively; keep Supabase old data read-only.

**Gate F:** create→display matrix passes against production canary; backup timestamp and restore command verified; business owner approves.

### Phase G — soak and decommission

1. Soak at least one normal business cycle.
2. Reconcile writes, notifications, uploads, and reports daily.
3. Remove Vercel Supabase secrets/runtime code only after rollback window.
4. Retain backups according to policy; then decommission Supabase resources intentionally.

---

## 11. Rollback policy

- Use expand/contract migrations; no destructive schema change before soak completion.
- Keep the previous Rust binary/systemd unit and Vercel deployment ready.
- Lower DNS TTL before cutover, but prefer stable API hostname so rollback changes origin/upstream rather than clients.
- Before first Rust write, rollback to old Supabase is straightforward.
- After Rust accepts writes, **do not re-enable the old Supabase system as writable** without replaying/reconciling new writes. That would create split-brain/data loss. Prefer frontend rollback while retaining Rust as API, or forward-fix Rust.
- Upload migration needs an immutable mapping and dual-read window; never delete old objects during the initial cutover.
- Database rollback means restore to a new database and repoint after validation, not destructive in-place downgrade.

---

## 12. Acceptance criteria for GO

All are required for full-product GO:

- [ ] Vercel active Apollo client calls Cloudflare/Rust, not Next Yoga.
- [ ] No Vercel Supabase service-role credential.
- [ ] Firebase/legacy token policy is explicit; Rust GraphQL verifies the browser issuer.
- [ ] Exact CORS tests pass; wildcard credentialed CORS removed.
- [ ] Cookie/CSRF policy passes real-browser tests if cookies are used.
- [ ] Task, member, plan, notification parity register closed or explicitly feature-disabled.
- [ ] Report and every design screen have a supported Rust API path.
- [ ] Current project/task create defects fixed and covered by E2E.
- [ ] Secure durable upload path operational.
- [ ] Realtime is either implemented/authenticated/recoverable or UI promises are reduced to refetch behavior.
- [ ] One authoritative migration chain passes all three source-state tests.
- [ ] Backup restore drill and production-shaped query benchmarks pass.
- [ ] Seed is deterministic, idempotent, and production-guarded.
- [ ] Screen matrix is executable and green after hard reload/new browser context.
- [ ] Credential artifact removed/rotated and release image verified clean.
- [ ] Health, logs, metrics, alerts, runbook, and rollback rehearsal complete.

## Final disposition

**Approve the target architecture with the bearer-first/Firebase and single-Rust-API boundaries above. Do not approve production cutover yet.** Sequence work as: security/config boot fixes → authoritative DB/migration baseline → Rust report/design/API parity → web endpoint/auth switch → upload/realtime decisions → executable create→display E2E → staged data cutover. Supabase removal is the final convergence step, not the first.
