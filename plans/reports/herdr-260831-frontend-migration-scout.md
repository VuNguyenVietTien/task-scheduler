# Frontend Migration Scout — web/ and frontend/ Next.js Apps Audit

- **Date:** 2026-08-31
- **Mode:** read-only scout investigation. Only file written: this report. No source/config/deploy changes.
- **Scope:** `/Users/TienVNV/Desktop/ProjectManager/web/` and `/frontend/` Next.js apps; cross-check against `backend/schema.graphql` and `design-doc-service/`. Repo state: branch `feat/vercel-supabase-migration`, dirty working tree (2,092 pre-existing entries in `git status`); all file:line evidence taken from the current working tree.
- **Method:** direct file reads, `grep`/`find` over `web/src`, `frontend/src`, `backend/schema.graphql`, `design-doc-service/src`; importer tracing for dead-code calls; verification of claims in `plans/reports/herdr-260831-vercel-rust-cloudflare-architecture-review.md` (sections 0–4, 9). All paths below are repo-root-relative.
- **Confidence notes:** All file:line citations were spot-checked by re-reading the cited location. Runtime traffic and Vercel environment state cannot be observed from the repo and are marked UNVERIFIED where relevant.

---

## Section A — Vercel deploy target verdict

**Verdict: `web/` is the real Vercel deploy target (confidence: HIGH for repo-level evidence). `frontend/` is a stale pre-migration near-copy pointing at the legacy Rust backend, with no Vercel linkage and zero Supabase code.** Which project actually receives production traffic is UNVERIFIED from the repo (no deploy logs/remote state observable); every repo artifact points at `web/`.

| Evidence item | web/ | frontend/ |
|---|---|---|
| `vercel.json` | present — `web/vercel.json:1-3` (`$schema` only) | **absent** (`ls frontend/vercel.json` → no such file) |
| `.vercel/` project link | present (untracked) — `web/.vercel/project.json:1` = `{"projectId":"prj_q4s9b505ULq8NkSwy0FDWMK0uoz3","orgId":"team_x3BJBnMaOL2NCDpQ74kb1Pv9"}`, folder created 2026-03-28 | **absent** |
| `.gitignore` ignores `.vercel` | `web/.gitignore:36-37` | `frontend/.gitignore:37` (same rule, but no `.vercel` dir exists) |
| Supabase deps | `web/package.json:35-36` (`@supabase/ssr ^0.9.0`, `@supabase/supabase-js ^2.100.1`) | `grep -c supabase frontend/package.json` → **0** (no Supabase at all) |
| Apollo URI | same-origin `/api/graphql` — `web/src/lib/apollo-client.ts:9` | legacy `${NEXT_PUBLIC_BACKEND_URL}/graphql` — `frontend/src/lib/apollo-client.ts:10` |
| Next Yoga GraphQL API routes | `web/src/app/api/graphql/route.ts`, `web/src/app/api/design-doc/route.ts` | **absent** (frontend API routes are legacy REST only, e.g. `frontend/src/app/api/projects/route.ts`) |
| Supabase lib + realtime + i18n | present (`web/src/lib/supabase/*`, `web/src/hooks/use-realtime-*.ts`, `web/src/i18n/*`) | **absent** (diff of `git ls-files web/src` vs `frontend/src` shows all of these only in web/) |
| Docs evidence | `docs/system-architecture.md:5` — "the new `web/` codebase unifies both backends into GraphQL Yoga with Supabase"; `:7` — "`frontend/` + Rust backends remain production until validation complete" | described as legacy in same doc |
| Dockerfile | present in both (legacy parity; review doc §3 notes web Docker standalone mismatch) | present |

Supporting: `web/.vercel/README.txt` states the folder is created by `vercel link`. Migration-history reports `plans/reports/project-manager-260327-1131-vercel-supabase-migration-update.md` and `plans/reports/code-reviewer-260327-1106-vercel-supabase-migration.md` exist but were not needed beyond corroboration.

---

## Section B — Apollo/GraphQL endpoints + auth flow map

### B1. Apollo clients in web/

| Client | File:line | URI | Auth token source | Mounted by |
|---|---|---|---|---|
| Main client | `web/src/lib/apollo-client.ts:9-12` — `uri: '/api/graphql'`, `credentials: 'same-origin'`; `:19-32` authMiddleware = Supabase `createBrowserClient().auth.getSession()` → `Authorization: Bearer <supabase access_token>` | same-origin Next Yoga | **Supabase session JWT** (not Firebase) | `web/src/app/layout.tsx:25` → `ClientProviders.tsx:25` (`<ApolloProvider client={client}>`); also `web/src/app/Providers.tsx:11` (duplicate provider composition, uses same client) |
| Design-doc client | `web/src/apollo/design-doc-client.ts:7-9` — `uri: '/api/design-doc'`; `:11-19` authLink = `getAuthToken()` Bearer | same-origin design-doc Yoga | **Firebase ID token** from `auth-token` cookie via `web/src/apollo/get-auth-token.ts:22` (GET `/api/auth/get-token`, 10-min cache) | `web/src/app/designs/layout.tsx:7,27` (wraps all `/designs/*`); `web/src/components/projects/DocumentsTab.tsx:6,27` |
| Dead legacy client | `web/src/lib/apollo.ts:4-5` — `uri: REACT_APP_GRAPHQL_URL \|\| 'http://localhost:8000/graphql'` | legacy | n/a | **no importers found** (grep) — dead |
| Dead duplicate provider | `web/src/hooks/ApolloClient.tsx:8-9` imports same client | — | — | **no importers found** — dead |
| Dead legacy helper | `web/src/lib/graphqlClient.ts:20` (`supabase.auth.getSession`) | — | — | **no importers found** — dead |

Dev-only op logger posts to `/api/dev/graphql-log` (`web/src/lib/apollo-client.ts:44-49,57-88`).

### B2. Server-side GraphQL (Next Yoga)

1. **Main Yoga** — `web/src/app/api/graphql/route.ts:7-14`: `createYoga({ schema, graphqlEndpoint:'/api/graphql', context: createContext })`. Schema merges resolvers under `web/src/lib/graphql/resolvers/` (project, task, user, comment, plan, notification, system, module, document, screen, component, flow, external-link, tag). Context `web/src/lib/graphql/context.ts`:
   - `:16` `supabase.auth.getUser()` (anon-key server client);
   - `:20-30` service-role lookup of app `users.user_id` by email (Supabase auth UUID ≠ FK UUID);
   - `:36-90` **fallback**: if no Supabase user, trusts unverified `user-session` + `auth-token` cookies and auto-provisions a `users` row (fail-open identity).
2. **Design-doc Yoga** — `web/src/app/api/design-doc/route.ts:9-19`: second Yoga instance, schema `web/src/lib/design-doc/schema.ts`, resolvers `web/src/lib/design-doc/resolvers.ts`, context = `createAdminClient()` **service role** (`:17-19`). Resolvers query Supabase directly: `resolvers.ts:106-107` (`systems`), `:115`, `:120` (`design_documents`), `:125` (`screens`), `:130` (`design_tags`), `:142-152` (inserts).
   - Stale comment: `design-doc-client.ts:6` claims the route proxies to `DESIGN_DOC_API_URL`; it does not — grep shows no `DESIGN_DOC_API_URL` import anywhere in `web/src` (env key exists in `web/.env.local` but is unused by code). UNVERIFIED whether an external design-doc deployment was used historically.

### B3. Auth flow end-to-end (login → session → GraphQL)

1. Browser Firebase sign-in: `web/src/lib/firebase.ts:66` (`signInWithGoogle`), imported by `web/src/contexts/AuthContext.tsx:5`.
2. `AuthContext.tsx:90-119` (Google) and `:152-190` (email/password) POST to `/api/auth/firebase/login` (`:99`, `:159`) with `firebase_token/email/name/firebase_uid`.
3. Server `web/src/app/api/auth/firebase/login/route.ts`:
   - `:19` `firebaseAdmin.auth.verifyIdToken()` (dynamic import of `web/src/lib/firebase-admin.ts`);
   - `:30-77` upsert app `users` row via service-role client;
   - `:79-108` `supabaseAdmin.auth.admin.generateLink({type:'magiclink'})` (auto-creating Supabase auth user `:79-89`) and returns `session.properties.email_otp`;
   - `:119-127` sets `auth-token` (Firebase token) + `user-session` cookies, `httpOnly:false`, `SameSite=Lax`, 24 h.
4. Browser establishes Supabase session: `AuthContext.tsx:127-135` and `:178-184` `supabase.auth.verifyOtp({email, token: email_otp, type:'email'})` — this produces the Supabase cookie session consumed by middleware and the Apollo authLink.
5. Middleware `web/src/middleware.ts`:
   - `:19-21` **fail-open env guard**: missing `NEXT_PUBLIC_SUPABASE_*` → `NextResponse.next()`;
   - `:25-27` `updateSession` (`web/src/lib/supabase/middleware.ts:12-34`) refreshes Supabase session cookies;
   - `:29-34` fallback accepts unverified `auth-token`+`user-session` cookie pair;
   - `:40-42` `catch { return NextResponse.next() }` — **fails open on error**.
6. Session-check surface `/api/auth/me` (`web/src/app/api/auth/me/route.ts:9-13`) only checks cookie **presence**; `:21-26` comment admits no verification ("In a real app, you would: 1. Verify the JWT token..."). `/api/auth/get-token` (`web/src/app/api/auth/get-token/route.ts:9-13`) returns the raw Firebase token from the cookie.
7. Logout: `AuthContext.tsx:211-215` → Firebase `signOutUser` + POST `/api/auth/logout` (cookie delete, `web/src/app/api/auth/logout/route.ts:10-11`).
8. Legacy auth routes still present: `web/src/app/api/auth/login/route.ts:15` (Supabase `signInWithPassword`), `register/route.ts:4,17,29` (admin `createUser`), `firebase/route.ts:4,35` (`admin.listUsers`), `google/route.ts:28,39` (proxies to `${config.backendUrl}/api/auth/firebase/login` where `config.backendUrl = NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'`, `web/src/lib/config.ts:7`), `resend-verification/route.ts:27,93` (fetches `${NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/**`), `set-cookie/route.ts`, `set-token/route.ts:42-46`.
9. Identity summary: **Firebase = identity issuer; Supabase = session carrier for the API plane.** Two token systems coexist; main GraphQL uses Supabase JWT, design-doc GraphQL uses the Firebase token from a non-HttpOnly cookie.

### B4. frontend/ divergence

`frontend/src/middleware.ts:5-17` is the pre-migration cookie-path guard with no Supabase; `frontend/src/app/api/auth/**` are legacy REST routes (login/register/firebase/login etc.) against the old backend; no Yoga route, no Supabase. Confirms "older near-copy".

---

## Section C — Active Supabase / Next Yoga runtime dependency inventory (web/)

Legend: **breaks?** = what stops working if `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` were removed today.

| # | Item | file:line | Active? | Breaks if env removed | P0/P1 |
|---|---|---|---|---|---|
| C1 | `@supabase/ssr` + `@supabase/supabase-js` packages | `web/package.json:35-36` | yes | everything below | P0 |
| C2 | Browser client singleton | `web/src/lib/supabase/client.ts:13-17` | yes | Apollo auth header (`apollo-client.ts:20-21`), OTP login (`AuthContext.tsx:127,178`), realtime hooks | P0 |
| C3 | Server (anon, cookie) client | `web/src/lib/supabase/server.ts:12-31` | yes | GraphQL context user, all Supabase-backed REST routes | P0 |
| C4 | Service-role admin client | `web/src/lib/supabase/server.ts:39-55` (`SUPABASE_SERVICE_ROLE_KEY` at `:41`) | yes | login user-upsert + magiclink (`auth/firebase/login/route.ts:30-108`), design-doc Yoga context (`api/design-doc/route.ts:18`), GraphQL admin lookups (`context.ts:22,45,57,72`), register (`auth/register/route.ts:14-29`), firebase route (`auth/firebase/route.ts:32-44`) | P0 |
| C5 | Middleware session refresh | `web/src/lib/supabase/middleware.ts:12-34`; guard `web/src/middleware.ts:19-21` | yes, but **silently degrades**: missing env → all routes pass (fail-open), error → pass | auth gating of UI routes | P0 (security) |
| C6 | Main Yoga context/resolvers | `web/src/app/api/graphql/route.ts:7-14`; `web/src/lib/graphql/context.ts:16,22`; resolvers `web/src/lib/graphql/resolvers/*.ts` → `web/src/lib/services/*.ts` (importers verified: task/project/comment/plan/notification resolvers) | yes | entire main GraphQL data plane | P0 |
| C7 | Design-doc Yoga | `web/src/app/api/design-doc/route.ts:9-19`; `web/src/lib/design-doc/resolvers.ts:106-152` | yes | all `/designs/**` + Documents tab data | P0 |
| C8 | Supabase Storage upload — media | `web/src/app/api/media/upload/route.ts:26-34` (bucket `media`, public URL) | yes | rich-text image upload via this route | P1 |
| C9 | Supabase Storage upload — attachments | `web/src/app/api/attachments/route.ts:28-36` (bucket `attachments`); delete `attachments/[attachment-id]/route.ts:42` | yes | attachment upload/delete | P1 |
| C10 | Realtime channels | `web/src/hooks/use-realtime-tasks.ts:27`, `use-realtime-notifications.ts:31`, `use-realtime-document.ts:26`; lib `web/src/lib/supabase/realtime.ts:15-25` | **defined, not consumed** (no importers of `use-realtime-*` in `web/src/app` or `web/src/components`) | nothing (dormant) | P2 |
| C11 | Env `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` | `web/src/middleware.ts:19`; `client.ts:14-15`; `server.ts:13-14`; `middleware.ts:12-13` | yes | see C2–C5 | P0 |
| C12 | Env `SUPABASE_SERVICE_ROLE_KEY` | `web/src/lib/supabase/server.ts:41` | yes | see C4 | P0 |
| C13 | Legacy Rust proxy routes (`BACKEND_URL`/`NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BACKEND_URL`) | `api/projects/**` routes (`projects/route.ts:27,73`, `projects/[id]/route.ts:22,72,118`, `tasks/*` routes `:11-13` `process.env.BACKEND_URL`), `auth/google/route.ts:28` + `lib/config.ts:7`, `auth/resend-verification/route.ts:27,93`, `services/imageService.ts:247-253` | partially (UI consumers: `useStorageSync.ts:38` for `/api/projects/{id}`; imageService for `/media/upload`) | breaks those legacy calls (independent of Supabase) | P1 |
| C14 | pages-router legacy uploads | `web/src/pages/api/uploadImage.ts:22` (writes local disk `MEDIA_UPLOAD_DIR`), `web/src/pages/api/upload.ts:6,22` (next-auth `getToken` import + use) | routable but **no callers found** | nothing | P2 (dead, delete) |
| C15 | FCM (Firebase messaging) | `web/src/services/notificationService.ts:1-11` (`register_fcm_token` mutation) + `web/src/components/common/FcmNotificationHandler.tsx:5`, mounted `web/src/app/dashboard/layout.tsx:9-10,74`; VAPID key in `web/.env.local` | yes | push notifications | P1 |

**Bottom line (confirms review doc §4):** unsetting Supabase env vars today breaks login, middleware gating (into fail-open), the entire main and design-doc GraphQL planes, and Storage — it is not an env-only removal; it is a coordinated 7-plane migration.

---

## Section D — Screen-by-screen CRUD migration table (web/)

Rust target column: **exists** = operation present in `backend/schema.graphql` (Mutation block starts `:178`, Query block `:413`); **missing** = no root in `backend/schema.graphql` (verified: greps for `systems(`/`screens(`/`reports(`/`createSystem`/`createReport`/`designDocuments` return nothing). Separate note: `design-doc-service/src/graphql/schema.rs:7-26` merges Query/Mutation roots for system/module/document/screen/component/flow/tag/impact/external-link — a **second Rust service** that could serve design ops if routed (decision per review doc §10 Phase C.3).

| Screen / surface | Entry file:line | Current data source | Rust target | P0/P1 | Notes |
|---|---|---|---|---|---|
| `/auth` | `web/src/app/auth/page.tsx:32-33,39-42` (`login`, `loginWithGoogle` from `useAuth`) | Firebase SDK → POST `/api/auth/firebase/login` (`AuthContext.tsx:99,159`) → Supabase `verifyOtp` (`AuthContext.tsx:128,179`) | exists (auth roots `register`/`login` `backend/schema.graphql:179-180`; Rust REST `/api/v1/auth/firebase/login` per review §1.1) | **P0** | token wiring must flip to Firebase-bearer; drop Supabase OTP hop |
| `/dashboard` | `web/src/app/dashboard/page.tsx:5-7`; hook `web/src/hooks/use-dashboard-tasks.ts:4-23` | GraphQL `GetDashboardTasks` → `tasks(assignee_id:)` (`web/src/graphql/queries/dashboard.ts:6-7`) via `/api/graphql` | exists — `tasks(project_id,status,assignee_id)` `backend/schema.graphql:425` | **P0** | endpoint+auth switch; enum casing defect affects creates made here |
| `/projects` list | `web/src/app/projects/page.tsx:3` → `web/src/components/projects/ProjectList.tsx:51` | `GET_USER_PROJECTS` (`web/src/graphql/queries/projects.ts:3`) | exists — `projects` `backend/schema.graphql:415` | **P0** | — |
| `/projects/new` | `web/src/app/projects/new/page.tsx:19,75` | `CREATE_PROJECT` → `create_project` (`web/src/graphql/queries/project.ts:70-73`) | exists — `backend/schema.graphql:181` | **P0** | **known defect**: page reads `data.createProject.projectId` (`:75`) but SDL returns `project_id` → post-create navigation broken (confirms review §9) |
| `/projects/{id}?tab=list` | `web/src/components/projects/ProjectDetailView.tsx:16` → `web/src/redux/features/tasksSlice.ts:53-57` (`client.query`); render `web/src/components/project/TasksTab.tsx` | GraphQL `tasks` query via redux/`/api/graphql` | exists — `:425` | **P0** | server pagination absent (review §9) |
| `?tab=kanban` | `web/src/components/tasks/KanbanBoard.tsx:119-120,412` → `useTaskStatusUpdate` (`web/src/hooks/useTaskStatusUpdate.ts:14`) + `tasksSlice.ts:75-85` | GraphQL `update_task_status` (`web/src/graphql/mutations/tasks.ts:4-5`) | exists — `update_task_status` `:201`, `reorder_tasks` `:204` | P1 | `reorder_tasks` Rust returns `[Task!]` vs web Boolean contract (review §9) |
| `?tab=gantt` (plans) | `web/src/components/timeline/Timeline.tsx:32,88`; redux `web/src/redux/features/plansSlice.ts:77-146` | GraphQL plan queries/mutations (`web/src/graphql/{queries,mutations}/plans.ts`) | exists — `createPlan`/`updatePlan`/`deletePlan`/`setPlanActive` `:225-237`, `get_project_plans`/`get_latest_project_plan`/`get_plan` `:433-437` | P1 | dual snake/camel aliases; `plan_data` shape mismatch (review §9) |
| `?tab=members` | `web/src/components/projects/MembersView.tsx:5-20`; `web/src/components/project/MembersTab.tsx`; redux `web/src/redux/features/membersSlice.ts:30-34,70-75,95-103,123-140` | GraphQL `GET_PROJECT_MEMBERS`/`INVITE_PROJECT_MEMBER`; **plus dead REST**: `fetch('/api/projects/{id}/members/bulk')` `membersSlice.ts:74` and `.../members/roles` `:102` — **no matching route.ts exists** under `web/src/app/api/projects/` (404) | exists — `project_members` `:421`, `add_project_member_by_email` `:205`, `update_multiple_members` `:209`, `remove_multiple_project_members` `:213`, `my_project_role` `:429` | P1 | op-name drift: web `invite_project_member` vs Rust `add_project_member_by_email` (review §9); dead bulk endpoints must be mapped to Rust bulk ops |
| `?tab=report` | `web/src/components/projects/ProjectDetailView.tsx:9` → `web/src/components/reports/ProjectReportView.tsx:3-8` → redux `web/src/redux/features/reportsSlice.ts:189-237` | GraphQL `GetProjectReports`/`GetReportDetail` (`web/src/graphql/queries/reports.ts:3,30`), `CreateReport`/`UpdateReport`/`DeleteReport` (`web/src/graphql/mutations/reports.ts:3,30,42`) via `/api/graphql` → Next resolvers → Supabase | **missing** (no report roots in `backend/schema.graphql`) | P0 (blocker for full cutover) | review §9 confirms blocked |
| `?tab=documents` | `web/src/components/projects/DocumentsTab.tsx:6,27` (`createDesignDocClient`) | GraphQL via `/api/design-doc` → Yoga → Supabase admin (`api/design-doc/route.ts:17-19`) | **missing in backend**; exists in separate `design-doc-service` (`src/graphql/schema.rs:7-26`) | **P0** | routing/port decision required |
| `/projects/{id}/add-task` | `web/src/app/projects/[id]/add-task/page.tsx:8` → `web/src/components/tasks/NewTaskForm.tsx:170,315` | GraphQL `CREATE_TASK` → `create_task` (`web/src/graphql/mutations.ts:3-5`) | exists — `:199` | **P0** | **defect** `:315` `progress_type: data.progressType.toUpperCase()` vs Rust lowercase enum (confirms review §9) |
| `/projects/{id}/tasks/{taskId}` (detail) | `web/src/app/projects/[id]/tasks/[taskId]/page.tsx:16-18,67` (`client` + `GET_TASK_BY_ID`); `web/src/components/tasks/TaskDetailPage.tsx:18-22,422-470` (comments/subtasks queries+mutations); images `TaskDetailPage.tsx:865,996` → `web/src/services/imageService.ts:247-253` | main GraphQL for CRUD; **legacy REST upload** `${NEXT_PUBLIC_BACKEND_URL}/media/upload` with cookies | exists — `task` `:423`, `task_comments` `:417`, `create_comment` `:182`, `upload_image` `:217`; REST `/media/upload` (`backend/src/api/media.rs`) | **P0** | mixed Redux/Apollo; upload surface must move to R2/hardened volume |
| `.../create-subtask` | `web/src/app/projects/[id]/tasks/[taskId]/create-subtask/page.tsx:5` (same `NewTaskForm`) | same as add-task | exists — `:199` + `task_subtasks` `:424` | P0 | same enum defect |
| `/designs` | `web/src/app/designs/page.tsx:9-10,17` (`projectId='1'` **hardcoded TODO**); layout client `web/src/app/designs/layout.tsx:7,27`; ops `web/src/graphql/queries/designs.ts:3-4`, `web/src/graphql/mutations/designs.ts:3-4` | `/api/design-doc` Yoga → Supabase | **missing in backend**; exists in `design-doc-service` | **P0** | projectId hardcode also needs product fix |
| `/designs/{systemId}` | `web/src/app/designs/[systemId]/page.tsx` (`GET_SYSTEM`, `CREATE_MODULE`, `CREATE_DOCUMENT`) | same | same | **P0** | — |
| `/designs/{systemId}/{moduleId}/{documentId}` | `web/src/app/designs/[systemId]/[moduleId]/[documentId]/page.tsx` (`GET_DOCUMENT`, `CREATE_SCREEN`) | same | same | P1 | — |
| `.../screens/{screenId}` | `web/src/app/designs/[systemId]/[moduleId]/[documentId]/screens/[screenId]/page.tsx` (`GET_SCREEN`, `CLEAR_SCREEN_DESIGN`); components `web/src/components/designs/{design-viewer-split-pane,paste-design-zone,flow-editor,component-description-table,external-link-panel}.tsx` | same + paste/update component/mapping/tag ops (`web/src/graphql/mutations/designs.ts:58-115+`) | same (missing in backend; in design-doc-service) | P1 | SVG sanitize/size controls required before public (review §9) |
| Global notifications UI | `web/src/components/layout/Header.tsx:16,57` (inline `GET_NOTIFICATIONS` gql → `/api/graphql`); REST fallbacks `web/src/app/api/notifications/route.ts:4,10`, `[id]/read/route.ts:4,14`; FCM `web/src/components/common/FcmNotificationHandler.tsx:5`; legacy camel ops `web/src/services/notificationService.ts:9-11,17-45` (`register_fcm_token` + `getNotifications`/`markNotificationAsRead` camel — op-name drift) | mixed GraphQL + Supabase REST routes | exists — `notifications` `:442`, `notification_count` `:444`, `register_fcm_token` `:188` | P1 | retire camel legacy service or align names |
| Rich-text editor media | `web/src/components/common/{AdvancedEditor,RichTextEditor}.tsx:7` → `imageService` → legacy REST `${NEXT_PUBLIC_BACKEND_URL}/media/upload` (`imageService.ts:247-253`) | legacy Rust REST | exists (REST) + `upload_image` GraphQL `:217` | P1 | competing upload paths (this vs `/api/media/upload` vs pages `/api/uploadImage`) must converge |

**frontend/ screens:** same route tree but no Supabase/Yoga; Apollo points at `${NEXT_PUBLIC_BACKEND_URL}/graphql` (`frontend/src/lib/apollo-client.ts:10`). No migration work should be done there; recommend marking it frozen/deletable after cutover (out of scope here).

---

## Section E — Independent write-ownership groups (parallel migration workers)

Disjoint file sets; each path is owned by exactly one group. Cross-group **import** dependencies are noted (ownership still disjoint).

| Group | Owns (exact paths) | Why disjoint |
|---|---|---|
| **W1 — auth & middleware** | `web/src/middleware.ts`; `web/src/lib/supabase/client.ts`; `web/src/lib/supabase/server.ts`; `web/src/lib/supabase/middleware.ts`; `web/src/lib/supabase/realtime.ts`; `web/src/lib/supabase/types.ts`; `web/src/contexts/AuthContext.tsx`; `web/src/lib/firebase.ts`; `web/src/lib/firebase-admin.ts`; `web/src/app/auth/**`; `web/src/app/api/auth/**`; `web/src/types/auth.ts` | All session issuance/verification/route-gating lives here. No other group edits auth internals. (W2 *imports* `createBrowserClient` from `client.ts` but does not modify it.) |
| **W2 — Apollo clients, providers, transport links** | `web/src/lib/apollo-client.ts`; `web/src/apollo/design-doc-client.ts`; `web/src/apollo/get-auth-token.ts`; `web/src/hooks/ApolloClient.tsx`; `web/src/lib/apollo.ts`; `web/src/lib/graphqlClient.ts`; `web/src/providers/ClientProviders.tsx`; `web/src/providers/QueryProvider.tsx`; `web/src/providers/SyncProvider.tsx`; `web/src/app/Providers.tsx`; `web/src/app/layout.tsx`; `web/src/hooks/useStorageSync.ts` | Owns endpoint URIs, link chains, provider mounting — the endpoint/auth **switch** itself. Touches no screen components and no resolver code. |
| **W3 — project / task / member / dashboard screens** | `web/src/app/projects/**`; `web/src/app/dashboard/**`; `web/src/components/projects/ProjectList.tsx`; `ProjectDetailView.tsx`; `ProjectPage.tsx`; `ProjectForm.tsx`; `MembersView.tsx`; `create-project-modal.tsx`; `web/src/components/project/**`; `web/src/components/tasks/**`; `web/src/components/dashboard/**`; `web/src/components/timeline/**`; `web/src/redux/features/{tasksSlice,membersSlice,plansSlice,taskDetailSlice,notificationsSlice}.ts`; `web/src/graphql/queries/{tasks,project,projects,GetProjectById,member,projectMembers,plans,dashboard,users}.ts`; `web/src/graphql/mutations/{tasks,projectMember,projectMembers,plans,notifications}.ts`; `web/src/graphql/mutations.ts`; `web/src/hooks/{useProject,useUsers,useTasks,useTaskStatusUpdate,use-dashboard-tasks,useProjectTasks}.ts` | Task/project/member domain screens and their GraphQL ops. Does not touch design/report files, transport, or API routes. Fixes `createProject.projectId` navigation and `progress_type` casing land here. |
| **W4 — design & report screens** | `web/src/app/designs/**`; `web/src/components/designs/**`; `web/src/components/reports/**`; `web/src/components/projects/DocumentsTab.tsx` (sole file this group owns under `components/projects/`); `web/src/graphql/queries/designs.ts`; `web/src/graphql/queries/reports.ts`; `web/src/graphql/mutations/designs.ts`; `web/src/graphql/mutations/reports.ts`; `web/src/redux/features/reportsSlice.ts`; `web/src/lib/design-doc/{schema,resolvers,types}.ts`; `web/src/services/{system,module,screen,document,component,flow,tag,external-link,audit}-service.ts`; `web/src/graphql/queries/mediaUpload.ts`/`web/src/graphql/mutations/mediaUpload.ts` if design-embedded images | Design-system and report domains; blocked on the Rust design/report decision, so can proceed independently. `DocumentsTab.tsx` is excluded from W3's list. |
| **W5 — API routes, server GraphQL, shared services** | `web/src/app/api/graphql/route.ts`; `web/src/app/api/design-doc/route.ts`; `web/src/lib/graphql/**` (schema, context, resolvers, utils); `web/src/lib/services/*.ts`; `web/src/app/api/comments/**`; `web/src/app/api/attachments/**`; `web/src/app/api/notifications/**`; `web/src/app/api/media/upload/route.ts`; `web/src/app/api/projects/**`; `web/src/app/api/dev/graphql-log/route.ts`; `web/src/lib/config.ts`; `web/src/services/imageService.ts`; `web/src/services/notificationService.ts`; `web/src/pages/api/**` | Server-side runtime surfaces (Yoga, Supabase REST routes, legacy proxies, upload/notification services). No screen or provider files. |

Notes: `web/src/hooks/useStorageSync.ts` (fetches `/api/projects/{id}`, `:38`) is placed in W2 because it is transport glue (mounted by `SyncProvider`); W5 owns the route it calls. If the two groups coordinate on that one call-site contract, no file overlap occurs.

---

## Section F — Minimal test/E2E matrix

Extends (does not duplicate) review doc §9: rows below are the *minimum executable* set mapped to test type and pass criteria; the §9 "mandatory E2E evidence" list (network op+status, canonical ID, DB persistence check, hard-reload display, second-role assert, negative assert, realtime where promised, cleanup marker) applies to every Playwright row.

| Screen / concern | Test type (tool) | Proves migration success | Priority |
|---|---|---|---|
| Auth login (Firebase→Rust) | Playwright E2E | network shows `POST api.<domain>/api/v1/auth/firebase/login`; subsequent GraphQL sends Firebase bearer; `/dashboard` renders user name; **no** Supabase cookie/OTP hop | **P0** |
| Middleware/route gating | Integration (node) + Playwright negative | unauth user redirected to `/auth`; tampered `user-session` cookie rejected (no fail-open); missing-env branch removed | **P0** |
| Apollo endpoint switch | Unit (jest) on link factory | client URI = `https://api.<domain>/graphql`; authLink sources Firebase token (mock) | **P0** |
| Project create→display | Playwright E2E | `create_project` op hits Rust; response `project_id` consumed; redirect lands on `/projects/{id}`; list shows name (regression for `new/page.tsx:75`) | **P0** |
| Task create (list tab + add-task + subtask) | Playwright E2E + jest unit on form mapper | lowercase `progress_type` sent (unit asserts no `toUpperCase`, kills `NewTaskForm.tsx:315` defect); task visible in list, dashboard, and subtask tree after reload | **P0** |
| Task detail edit + comment | Playwright E2E | `update_task`/`create_comment`/`delete_comment` ops hit Rust; reload shows edits; comment fields match query | **P0** |
| Kanban drag | Playwright E2E | `update_task_status` persists across reload; `reorder_tasks` contract (Rust `[Task!]`) handled | P1 |
| Gantt/plans | Playwright E2E | `createPlan`/`setPlanActive` → timeline renders active plan dates after reload | P1 |
| Members add/roles/bulk | Playwright E2E + jest role-map unit | `add_project_member_by_email` op used (not `invite_project_member`); bulk ops use `update_multiple_members`/`remove_multiple_project_members` (dead `/api/projects/{id}/members/*` fetches removed); `my_project_role` reflects change | P1 |
| Report create→display | Playwright E2E (**blocked until Rust roots exist**) | `CreateReport` hits Rust report root; period metrics render after reload | P0 (blocker-gated) |
| Documents/design chain (system→module→document→screen) | Playwright E2E | ops hit routed design service (design-doc-service or ported roots); `projectId` no longer hardcoded `'1'` | **P0** |
| Screen SVG viewer | Playwright E2E | paste SVG → sanitize → reload shows identical layers/components | P1 |
| Image upload (task/comment rich text) | Integration + Playwright | upload goes to R2/hardened endpoint (NOT `NEXT_PUBLIC_BACKEND_URL/media/upload` with cookies); durable HTTPS URL survives new session | P1 |
| Notifications | Integration (GraphQL op name parity) + optional FCM E2E | `notifications`/`register_fcm_token` hit Rust; dropdown count agrees after reload; camel legacy service retired | P1 |
| Dead code guard | jest lint-rule/grep CI check | no imports of `web/src/lib/apollo.ts`, `web/src/hooks/ApolloClient.tsx`, `web/src/lib/graphqlClient.ts`, `web/src/hooks/use-realtime-*.ts`, `web/src/pages/api/*` | P2 |
| Supabase zero-runtime check | CI grep gate | no `@supabase/*` imports outside quarantine dir; env vars absent from Vercel project without build failure | **P0** (final gate) |

Existing test base: 10 jest suites under `web/src/components/**/__tests__/` (e.g. `web/src/components/tasks/__tests__/TaskList.test.tsx`); **no Playwright config or e2e dir exists** (`web/package.json` has no playwright dep; verified) — Playwright must be added, matching review §9's closing note.

---

## Unresolved questions

1. Which Vercel project (`prj_q4s9b505ULq8NkSwy0FDWMK0uoz3` in `web/.vercel/project.json:1`) actually receives production traffic — UNVERIFIED from the repo; needs `vercel` CLI/`vercel ls` or dashboard check.
2. Design/report strategy: port roots into `backend/schema.graphql` vs route `design-doc-service` behind `api.<domain>` (review §10 Phase C.3 leaves this open) — W4 and the Section D design rows are blocked on it.
3. Are `membersSlice.ts:74,102` bulk-member REST calls (`/api/projects/{id}/members/bulk|roles`) currently broken in production (no matching route.ts), or is there an out-of-tree route/rewrite? Determines whether members bulk is a fix or pure re-pointing.
4. Should dormant Supabase Realtime hooks (`web/src/hooks/use-realtime-*.ts`) be deleted pre-cutover (they are unconsumed) or preserved for the future Rust WS/outbox phase?
5. Is `frontend/` formally frozen for deletion after cutover, or must it keep tracking `web/` during the soak period? (Affects whether W-groups must mirror changes there.)

---

/Users/TienVNV/Desktop/ProjectManager/plans/reports/herdr-260831-frontend-migration-scout.md
