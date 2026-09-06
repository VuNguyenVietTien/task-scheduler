# Backend Platform Hardening — P0/P1 (Vercel → Cloudflare → Rust)

**Agent:** w-platform (Sol/max implementation worker) | **Run:** herdr-260831 | **Status:** COMPLETE (final rework #2 — F1/F2 blockers đã đóng, chờ review)
**Inputs:** `plans/reports/herdr-260831-vercel-rust-cloudflare-architecture-review.md` (P0/P1 platform items), `plans/reports/herdr-260831-backend-platform-final-review.md` (verdict REWORK)
**Ownership (touched only):** `backend/src/main.rs`, `backend/src/api/routes.rs`, `backend/src/config.rs`, `backend/.env.example`, `backend/tests/platform/main.rs`, mới: `backend/src/migration_runner.rs`, `backend/src/bin/migrate.rs`. Không sửa `api/auth.rs`/`tests/auth/**` (đang review), không sửa GraphQL schema/resolvers, migrations/, routes của lane khác ngoài mount-point đã được giao. Không commit/push/deploy.

## 1. Deliverables theo mục tiêu

### (1) `/api/auth/refresh` alias — `src/api/routes.rs:91-98`
- `web::scope("/api").configure(auth::alias_config)` mount song song, không xung đột với `/api/v1` (scope v1 đăng ký trước, matched trước).
- Handler `refresh` nằm trong lane W1b (`api/auth.rs` — chỉ đọc, không sửa); platform chỉ cung cấp mount-point như review đã chỉ định.
- Test `live_health_and_auth_refresh_aliases_are_mounted` POST cả hai path, assert ≠ 404/405 (route tồn tại; 500 trong harness là do thiếu app-data, không phải routing).

### (2) Health endpoints — `src/api/routes.rs:23-62`
- `GET /health/live` → 200 `{status:"live", database:"unchecked"}` — liveness thuần process, không phụ thuộc DB (proxy/systemd giữ进程 alive khi DB down).
- `GET /health/ready` → `SELECT 1` qua pool: 200 `{status:"ready",database:"up"}` hoặc **503** `{status:"not_ready",database:"down"}` — readiness gate cho deploy/blue-green.
- Test: `readiness_is_503_when_database_is_unavailable` dùng `connect_lazy` pool vô hiệu (không network) → 503; `readiness_status_tracks_database` unit-test bảng trạng thái.

### (3) HOST/PORT mismatch — `src/config.rs:155-167`
- `SERVER_HOST`/`SERVER_PORT` là canonical; fallback `HOST`/`PORT` (Docker/Compose hiện có set HOST=0.0.0.0 — trước đây bị bỏ qua hoàn toàn, đây chính là P0 "container bind mismatch").
- Canonical thắng khi cả hai cùng tồn tại (test `config_supports_host_port_aliases_and_server_precedence`).
- Production (`APP_ENV=production`) không set gì → default bind **0.0.0.0:8080** — rỏ ràng, có test `production_defaults_bind_all_interfaces_and_parse_migration_flag`; dev default giữ `127.0.0.1`.

### (4) Credentialed CORS exact allowlist — `src/api/routes.rs:64-88` + `src/main.rs:117`
- Xóa `allow_any_origin().supports_credentials()` (P0). `build_cors()`: `.allowed_origin(origin)` cho từng entry của `config.frontend_origins`, `.block_on_origin_mismatch(true)` — **không còn wildcard path trong code**.
- Methods/headers giới hạn tường minh (GET/POST/PUT/PATCH/DELETE/OPTIONS; Authorization, Content-Type, Accept, X-Request-ID), `supports_credentials`, max_age 3600.
- Origins từ `FRONTEND_ORIGINS` (comma-separated) hoặc `FRONTEND_URL`; parser (`parse_frontend_origins`) từ chối wildcard/whitespace/thiếu scheme/path-bearing; production bắt buộc https.
- Test hành vi thật qua actix test-server: origin được phép → 200 + `Access-Control-Allow-Origin` exact + `Allow-Credentials: true`; origin lạ (`https://evil.example`) → **400, không có header CORS** (`cors_allows_exact_origin_and_rejects_untrusted_origin`).

### (5) Production validation fail-fast — `src/config.rs:30-49, 236-302, 350-424`
- `APP_ENV` (development|test|production; sai giá trị → boot error).
- Production bắt buộc: DATABASE_URL, JWT_SECRET và AUTH_SECRET **≥32 ký tự, không placeholder** ("change-me"…), **phải khác nhau**; origins https exact không wildcard; thiếu FRONTEND_ORIGINS/FRONTEND_URL → boot error. Test `production_rejects_missing_origins_weak_secrets_and_wildcards` phủ 4 nhánh từ chối.
- Dev defaults an toàn: auth_secret dev-only, origin `http://localhost:3000`.
- Config testable không đụng process-env: `Config::from_map` (HashMap) — tránh race giữa các test chạy song song (thay pattern set_var cũ).

### (6) Migration runner an toàn/idempotent — `src/migration_runner.rs`, `src/bin/migrate.rs`, `src/main.rs:79-83`
- `cargo run --bin migrate` giờ tồn tại thật (README trước đây hứa nhưng không có binary — P0). Single-connection pool, 30s acquire timeout.
- Startup: opt-in qua `RUN_MIGRATIONS` (default **false** — boot không tự đổi schema; test `development_defaults_and_optional_integrations`).
- Idempotent + concurrency-safe theo语义 sqlx `_sqlx_migrations` (version+checksum, advisory lock); chain embed compile-time qua `sqlx::migrate!`.
- **⚠️ Hazard có sẵn của chuỗi migration (ngoài ownership, migrations/ không được sửa):** sqlx sắp theo version tăng dần → `20230705000001_create_plans_table` và `20240616000001_create_reports_tables` (REFERENCES projects/users/plans/tasks) chạy **trước** `20250319000000_create_initial_schema` (bảng tạo sau) → first-run trên **DB rỗng sẽ fail** ở migration 2023. Đúng như finding Phase B của review ("reconcile one authoritative migration chain"). Cần DB-owner đổi version/reorder chuỗi; runner đã fail-fast đúng, không skip lặng. Với DB đã migrate (bảng `_sqlx_migrations` đủ) runner là no-op an toàn.

### Bonus P0/P1 lân cận (cùng file ownership)
- `main.rs:71-77`: PgPoolOptions explicit (`DB_MAX_CONNECTIONS=5`, `DB_CONNECT_TIMEOUT=30s`) thay `PgPool::connect` — hết cảnh "pool policy unused" mục 7.2 review.

## 2. Verification (chạy lại sau model switch, kết quả thực)

| Gate | Kết quả |
|---|---|
| `rustfmt --check` (7 file platform) | **exit 0** |
| `cargo check --lib --tests` | **exit 0, 0 errors** |
| `cargo check --bin migrate` | **exit 0, 0 errors** |
| `cargo test --test platform` | **6/6 pass** (0.12s) |
| `cargo test --lib config::tests` | **4/4 pass** |
| `cargo test --lib api::routes::tests` | **1/1 pass** |
| `cargo fmt --check` (workspace) | exit 1 — **chỉ** 10 hunks trong 4 file `src/email/mod.rs`, `src/entity/mod.rs`, `src/lib.rs`, `src/session/mod.rs`: ngoài ownership, `git status` xác nhận **untouched tại HEAD** (drift có sẵn từ trước, không phải của lane này). Không sửa để không vi phạm ownership. |
| `git diff --check` (7 file owned) | exit 0 (no whitespace errors) |
| W1a/W1b lanes | chia sẻ worktree, compile chung pass; `alias_config` (auth.rs:639) nguyên vẹn — chỉ đọc |

## 3. Files changed

- `backend/src/main.rs` — CORS builder thay wildcard; bounded pool; RUN_MIGRATIONS gate; `mod migration_runner`.
- `backend/src/api/routes.rs` — `/health/live`, `/health/ready` (DB readiness), `build_cors`, mount `/api` alias scope; unit test readiness mapping.
- `backend/src/config.rs` — `AppEnvironment`, HOST/PORT aliases, `frontend_origins` exact allowlist + parser/validator, production fail-fast secrets, `run_migrations`, `from_map` testable; removed process-env mutation tests.
- `backend/.env.example` — contract một nguồn: APP_ENV, SERVER_*/HOST/PORT aliases (kèm chú thích production bind), RUN_MIGRATIONS, FRONTEND_URL/FRONTEND_ORIGINS (không wildcard, prod https), JWT/AUTH_SECRET yêu cầu prod, cookie prod matrix; bỏ `CORS_ORIGIN` (code chưa bao giờ đọc biến này — wildcard cũ là nguồn thật của lỗ hổng).
- `backend/tests/platform/main.rs` (mới) — 6 tests: alias+live, readiness 503, CORS allow/reject hành vi, HOST/PORT precedence, prod defaults+RUN_MIGRATIONS, prod validation rejections.
- `backend/src/migration_runner.rs`, `backend/src/bin/migrate.rs` (mới) — runner + binary.

## 4. Hand-off / follow-ups (ngoài ownership)

1. **DB owner (P0):** reorder/re-version chuỗi migration (plans/reports trước initial schema → empty-DB fail); khuyến nghị theo Phase B của architecture review.
2. **Deployment owner:** biến prod bắt buộc: `APP_ENV=production`, `SERVER_HOST=0.0.0.0`, `FRONTEND_ORIGINS=https://app.example.com[,https://staging...]`, JWT/AUTH_SECRET ≥32 khác nhau, `RUN_MIGRATIONS` chỉ bật khi chủ động. Cookie prod: SECURE=true/SAMESITE=none/HTTP_ONLY=true (đã document trong .env.example).
3. **main.rs lane sau (P1 còn lại):** GraphiQL GET `/graphql` vẫn mở ở production; `backend.log` file logging; fixed-path firebase service-account + credential file trong Docker context (P0 của review, thuộc security/deploy lane).
4. **fmt debt:** 4 file drift ở HEAD (email/entity/lib/session) — chủ lane tương ứng chạy `cargo fmt` một lần.

## 5. Unresolved questions

- Chuỗi migration: giữ nguyên version hiện tại cho DB đã deploy (runner no-op) và đổi tên file có cơ chế gì cho DB rỗng — cần DB owner quyết (khả thi: migration bridge mới `20250320000000` tái tạo thứ tự, hoặc chấp nhận chỉ hỗ trợ DB đã có baseline).

---

# Rework (F1–F4) — theo `herdr-260831-backend-platform-review.md`

**Vai trò lượt này:** DB/platform owner (được phép `backend/migrations/**` + platform files). Không sửa auth.rs/tests auth/GraphQL resolvers; không commit/push/deploy. **Không sửa file migration nào** (`git diff backend/migrations` = rỗng) → zero checksum risk với DB đã applied — constraint F1 được bảo đảm bằng chính sqlx (VersionMismatch enforcement) + files bất biến.

## F1 — Migration strategy forward-only, fresh + existing compatible ✅

**Thiết kế** (`src/migration_runner.rs` rewrite; `src/bin/migrate.rs` +`--baseline`):
- Files trong `backend/migrations/` là history bất biến (không edit/rename/delete). Migration mới = file mới version lớn hơn.
- **DB có history** (`_sqlx_migrations` có row success): chạy stock `MIGRATOR` (version order) — chỉ apply pending, checksum-validate mọi row đã applied.
- **DB rỗng**: bootstrap — SAME files, SAME checksums, nhưng theo **dependency order** `BOOTSTRAP_ORDER` = [20250319 baseline → 20230705 plans → 20240616 reports → 20250408 → 20250501 → 20260325 → 20260328]; version nào thêm sau này tự append ascending (forward-compatible với order list). History ghi lại byte-compatible với stock `sqlx::migrate!` (dựng `Migrator{migrations: reordered, locking:true}` — mọi DDL/lock/insert vẫn do sqlx thực hiện).
- **DB có schema nhưng không history**: từ chối + hướng dẫn `--baseline` tường minh (mark tất cả applied KHÔNG execute — insert `success=true, execution_time=-1` đúng shape sqlx, checksum gốc; `ON CONFLICT DO NOTHING`; không chạy 2 lần).
- **Dirty row** (success=false): refuse ở mọi path.

**Evidence tự động trên PostgreSQL thật** (local 127.0.0.1:5432, isolated throwaway DBs `platform_evidence_*`, tự DROP sau test; DB dev `task_scheduler_db` chỉ dùng làm TEMPLATE clone — verified nguyên vẹn sau chạy: 5 rows, max=20250501000000):
- `cargo test --test platform -- --ignored` → **3/3 pass (0.53s)**:
  - **Case A fresh**: bootstrap áp đủ 7 versions (`BootstrappedFresh{applied:7}`), đủ bảng users/projects/tasks/comments/notifications/plans/reports, state `Current`; chạy lại → `ForwardOnly{applied:0}` (idempotent); **stock `sqlx::migrate!` run sau bootstrap = Ok** (checksum byte-compatible).
  - **Case B already-deployed**: clone `task_scheduler_db` (5 applied, 2 pending) → probe `Stale{applied:20250501000000, expected:202603280000001}` → run → `ForwardOnly{applied:2}` (đúng số pending tính động) → `Current`; không re-execute rows đã applied.
  - **Case C pre-existing**: schema marker `users` không history → run **refuse** (message chứa "baseline"); `baseline()` → `BaselineMarked{marked:7}`, state `Current`, bảng `projects` KHÔNG tồn tại (chứng minh không execute); baseline lần 2 → refuse.

## F2 — Readiness: timeout ngắn + migration currency ✅

`src/api/routes.rs`:
- Probe bị chặn bởi `tokio::time::timeout` **1500ms** toàn phần (SELECT 1 + migration state) — không thể treo quá ngân sách proxy kể cả khi connection đã acquire nhưng unhealthy.
- Currency check: `migration_runner::probe_state` → `Current | Stale{applied,expected} | Dirty | NoHistoryTable | NoHistory`; chỉ `Current` → 200 `{status:"ready",database:"up",migrations:"current"}`; stale/dirty/missing → **503** với label tương ứng; DB down/timeout → 503 `{database:"down"}`.
- Pure `readiness_decision(ReadinessInput)` — test matrix đầy đủ 7 trạng thái (down, timed-out, stale, dirty, missing×2, current); endpoint test với lazy pool vô hiệu → 503 down.
- Bootstrap/CASE evidence đồng thời chứng minh trạng thái thật: probe stale → migrate → probe current (Case B).

## F3 — Production cookies fail-fast ✅

`src/config.rs` (+ `COOKIE_JS_COMPAT`):
- `APP_ENV=production`: `COOKIE_SECURE=false`/unset → **boot error**; `COOKIE_HTTP_ONLY=false`/unset → **boot error** trừ khi `COOKIE_JS_COMPAT=true` tường minh (compat mode in cảnh báo XSS token-theft risk đã chấp nhận).
- SameSite rules giữ nguyên: `None` ⇒ force Secure; prod validation chạy trên raw value nên samesite=None + secure unset cũng bị chặn.
- Dev defaults không đổi (lax/false/false). `.env.example` ghi rõ prod fail-fast matrix.
- Tests: insecure defaults bị reject (2 case), compat mode hợp lệ, hardened policy parse đúng.

## F4 — Production bind safe/explicit ✅

`src/config.rs`:
- Default khi không set SERVER_HOST/HOST: **127.0.0.1** (loopback an toàn) — bỏ default 0.0.0.0 cũ; test cũ `production_defaults_bind_all_interfaces` được thay bằng `production_defaults_to_safe_loopback_bind`.
- Container/public vẫn bind mọi interface **chỉ khi set tường minh** (`HOST=0.0.0.0` Docker/Compose hoặc `SERVER_HOST=0.0.0.0`) — test `production_container_sets_explicit_public_bind`.
- Prod bind non-loopback → eprintln cảnh báo firewall/proxy (không error — container hợp lệ).

## Files changed (rework)

`src/migration_runner.rs` (rewrite), `src/bin/migrate.rs` (rewrite +--baseline), `src/api/routes.rs` (readiness v2 + pub HealthResponse), `src/config.rs` (F3/F4), `src/main.rs` (log MigrationOutcome), `.env.example` (F3/F4 docs), `tests/platform/main.rs` (12 tests + mod evidence), `tests/platform/migration_evidence.rs` (mới, 3 #[ignore] live tests).
**Disclosed: `src/lib.rs` +1 dòng** (`pub mod migration_runner;`) — cần để lib tree (routes.rs + integration tests) thấy module; additive, không đụng code khác. `backend/migrations/**` KHÔNG sửa.

## Verification (chạy lại lượt này, kết quả thực)

| Gate | Kết quả |
|---|---|
| `cargo check --lib --tests --bin migrate` | **0 errors** |
| `cargo test --test platform` | **12 passed, 0 failed, 3 ignored** (evidence) |
| `cargo test --test platform -- --ignored` (live PG) | **3/3 passed** (A/B/C như trên) |
| `cargo test --lib migration_runner::tests` | **3/3 passed** (sau khi fix 1 test bug: assert `.first()` trên list đã sort — sai ở test, không phải implementation) |
| `cargo test --lib config::tests` | **4/4** |
| `cargo test --lib api::routes::tests` | **1/1** |
| `cargo test --test auth` (regression lane W1b) | **21/21** |
| `cargo fmt --check` (workspace) | **exit 0** — 4 file drift cũ (email/entity/lib/session) đã được lane khác format; toàn workspace giờ sạch |
| `rustfmt --check` 8 owned files | **exit 0** |
| `git diff --check` owned files | **exit 0** |
| Post-evidence cleanup | 0 leftover `platform_evidence%` DBs; `task_scheduler_db` nguyên vẹn |

## Cập nhật các mục cũ của report

- **§4.1 (DB owner handoff): ĐÃ GIẢI QUYẾT** ở mức runner (lượt này tôi là DB owner): fresh DB bootstrap dependency-order, existing DB forward-only stock-order, baseline tường minh — không cần reorder/re-version files. Lưu ý: ai **bypass** runner dùng stock `MIGRATOR` trực tiếp trên DB rỗng vẫn fail như cũ — mọi path chính thức (`bin/migrate`, `RUN_MIGRATIONS=true`) đã đi qua strategy.
- **§4.4 (fmt debt): ĐÃ GIẢI QUYẾT** — `cargo fmt --check` workspace giờ pass.
- **§5 (unresolved migration question): ĐÓNG** — không đổi version/file nào; fresh-DB khởi tạo qua bootstrap order của runner.
- §4.2 deployment env matrix cập nhật: prod bắt buộc thêm `COOKIE_SECURE=true`, `COOKIE_HTTP_ONLY=true` (hoặc `COOKIE_JS_COMPAT=true` tường minh), `SERVER_HOST` mặc định an toàn 127.0.0.1 (container set 0.0.0.0 tường minh).

---

# Final rework #2 — đóng toàn bộ blocker của `herdr-260831-backend-platform-final-review.md`

**Vai trò:** platform/migration owner. Chỉ sửa platform files + tests; không sửa frontend/event bridge/GraphQL/migrations (`git diff backend/migrations` = rỗng).

## F1 — baseline không thể chứng nhận empty/partial schema ✅

`src/migration_runner.rs` (hoàn thiện rework dở trong worktree):

1. **Refuse empty DB** — `baseline()` yêu cầu schema khớp MỘT fingerprint embedded (bảng+cột+enum labels, cumulative theo dependency). DB rỗng match 0 fingerprint (v1 cần đủ 15 bảng) → refuse; DB chỉ có `users` cũng refuse (evidence C2). Đóng finding "single users table = parity".
2. **Validate full schema fingerprint** — `VERSIONED_FINGERPRINTS` per-version cumulative (tables/columns/enum-values), derive trực tiếp từ 7 file migration; enum check giới hạn `public` schema. Unit test ép fingerprint phủ đúng mọi version + strictly discriminating (v2 phải có `plans` — bug rework dở đã fix).
3. **Chỉ mark versions thực sự represented** — mark theo **dependency prefix** `0..=idx` của fingerprint khớp, KHÔNG phải "toàn bộ 7" hay "version ≤ represented" (version-order ≠ dependency-order ở đầu chain). Phát hiện thêm nhờ unit test mới: schema v1-only/v2-only **không expressible** thành ascending prefix của chain theo version → `baseline()` refuse tường minh (`prefix_expressible`), tránh tạo history khiến stock run sau đó fail. Evidence C: legacy schema tới 20250501 → `BaselineMarked{marked:5, represented:20250501}` → state `Stale` → run apply đúng 2 pending → `Current`.
4. **Advisory lock + single transaction** — toàn bộ baseline (re-validate history/dirty dưới lock → fingerprint → `CREATE TABLE IF NOT EXISTS _sqlx_migrations` → insert synthetic rows) nằm trong MỘT tx giữ `pg_advisory_xact_lock` với **cùng lock-id algorithm** như `Migrator::run` (CRC-32/ISO-HDLC(db_name) × 0x3d32ad9e, có unit test reference vector) — concurrent migration không thể quan sát partial history.
5. **Reject unknown CLI args** — `bin/migrate.rs` parse strict: `[]` → apply, `["--baseline"]` → baseline, bất kỳ thứ gì khác (`--baselin`, `--BASELINE`, positional, lặp flag) → in usage + **exit 2**, không bao giờ rơi silently vào normal path. Unit tests trong bin.

## F2 — readiness xác minh toàn bộ embedded version/checksum ✅

`probe_state` strong-currency: `Current` chỉ khi history = đúng embedded chain — **không có version lạ/ahead** (`Ahead`), **không thiếu version interior** (`MissingInterior`), **checksum byte-identical mọi row** (`ChecksumMismatch`), đúng prefix ascending (`Stale` khi thiếu cuối chuỗi), và **schema contract bảng cuối cùng tồn tại** (`PartialSchema` — chặn synthetic/tampered history "trông" đầy đủ). `readiness_decision` match đầy đủ 8 trạng thái → chỉ `Current` trả 200; 4 trạng thái guard trả 503 kèm label chính xác (`missing-interior`/`checksum-mismatch`/`ahead`/`partial-schema`).

## Files changed (final rework #2)

- `backend/src/migration_runner.rs` — fingerprints (fix v2 +plans), `represented_version` qua `&mut PgConnection`, `prefix_expressible` + refusal, baseline mark theo dependency-prefix set dưới lock/tx, `probe_state` strong-currency, `applied_rows`/`successful_count` chuyển sang conn-scoped (pool 1-connection của bin/migrate không deadlock), `label(&self)`, 7 unit tests.
- `backend/src/api/routes.rs` — `readiness_decision` đầy đủ 4 trạng thái guard (503 + label), bỏ derive `Copy`, unit test matrix mở rộng.
- `backend/src/bin/migrate.rs` — strict CLI parsing (`parse_args` + usage + exit 2), unit tests; không còn "any arg containing --baseline".
- `backend/tests/platform/main.rs` — matrix test thêm 4 guard states; `!config.run_migrations` thay `== false`.
- `backend/tests/platform/migration_evidence.rs` — rewrite Cases A–E theo contract mới (chi tiết dưới).

## Tests / Evidence (chạy thực, local PostgreSQL 127.0.0.1:5432)

| Gate | Kết quả |
|---|---|
| `cargo check --lib --tests --bin migrate` | **0 errors** |
| `cargo fmt --check` (workspace) | **pass** |
| `cargo clippy --bin migrate` / owned files | **0 warnings** owned (2 warning "never used" chỉ xuất hiện khi build tổ hợp `--tests`, artifact của target-combination, bin thật gọi `baseline`) |
| `cargo test --lib migration_runner::tests` | **7/7** (kể cả `dependency_prefixes_are_prefix_expressible_only_from_reports_on` — chính test này bắt ra bug v1/v2-only ở trên) |
| `cargo test --lib config::tests` / `api::routes::tests` | **4/4**, **1/1** |
| `cargo test --bin migrate` | **1/1** (strict args) |
| `cargo test --test platform` | **12 passed, 5 ignored** (matrix đầy đủ 8 states) |
| `cargo test --test platform -- --ignored --test-threads=1` (live PG) | **5/5** |
| `cargo test --test auth` (regression lane W1b) | **21/21** |
| Post-run cleanup | **0** `platform_evidence%` DBs sót (đã dọn 5 DB leak từ các lần chạy fail giữa chừng khi debug); `task_scheduler_db` nguyên vẹn: 5 rows success, max `20250501000000` |

Live evidence chi tiết (throwaway DBs, tự DROP):

- **A fresh**: `baseline()` REFUSE DB rỗng → bootstrap 7 versions dependency-order → đủ bảng → `Current` → re-run `ForwardOnly{0}` → stock `sqlx::migrate!` run **Ok** (checksum byte-compatible).
- **B deployed**: clone `task_scheduler_db` → `Stale` → `ForwardOnly{applied:2}` (đúng số pending tính động) → `Current`, không re-execute applied rows.
- **C legacy baseline**: schema legacy qua 20250501 (build bằng chính SQL embedded, dependency order, không history) → `run()` refuse (message chứa "baseline") → `baseline()` = `BaselineMarked{marked:5, represented_version:20250501000000}`, KHÔNG execute gì thêm (count vẫn 5) → probe `Stale{20250501→20260328…}` → `run()` = `ForwardOnly{applied:2}` → `Current` → stock run Ok → baseline lần 2 refuse. **C2 partial**: DB chỉ có `users` → `baseline()` refuse "ANY embedded version", 0 synthetic rows.
- **D tampered** (bootstrap thật → Current, rồi lần lượt + restore): DELETE interior row `20250408` → `MissingInterior{20250408}` + `/health/ready` **503 `missing-interior`**; corrupt checksum `20250319` → `ChecksumMismatch` + **503**; INSERT version tương lai `20990101000000` → `Ahead` + **503**; restore → `Current` + **200** (guards chính xác, không sticky).
- **E synthetic**: DB rỗng + `_sqlx_migrations` đủ 7 rows đúng version/checksum nhưng KHÔNG schema → probe `PartialSchema` + `/health/ready` **503 `partial-schema`** — chặn đúng kịch bản review chỉ ra.

## Out-of-ownership findings (không sửa, báo lại)

- `cargo test --lib auth::auth_common::tests::test_token_flow` FAIL (đã fail trước thay đổi này): test INSERT thiếu cột `username` NOT NULL khi chạy với `DATABASE_URL` thật; file `src/auth/auth_common.rs` thuộc lane auth đang review — không đụng. Toàn bộ suite khác trong `--lib` (57 tests) pass.

## Unresolved questions

- Không còn blocker F1/F2 nào mở. Một điểm thiết kế đã chốt: baseline **không hỗ trợ** legacy schema cũ hơn 20240616 (v1/v2-only) vì không biểu diễn được thành prefix hợp lệ — operator phải import đầy đủ tới mức reports hoặc drop+bootstrap; đã mã hoá trong refusal message + unit test.
