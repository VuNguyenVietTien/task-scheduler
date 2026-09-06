# Ubuntu Deploy Preflight — Task-Scheduler Backend (read-only)

**Agent:** w-platform | **Date:** 2026-08-31 | **Mode:** READ-ONLY (ssh alias `u` = 192.168.1.5, host `khampha`, LAN). Không deploy/restart/delete/rotate/commit; không sửa server. Mọi command chỉ đọc (`systemctl cat/status/show`, `ls`, `git log/remote/cat-file -t`, `docker exec psql SELECT`, `ss`, `curl GET` + `POST {__typename}`).
**Secret hygiene:** chỉ ghi env **KEY NAMES**; không có giá trị secret nào được in. `khampha_user`/`khampha_db` là metadata vận hành, không phải credential.

## 1. ⚠️ CRITICAL FINDING — `khampha-backend.service` KHÔNG PHẢI deploy target của task-scheduler backend

| | Server (`khampha-backend.service`) | Local dirty backend |
|---|---|---|
| Repo | `github.com/VuNguyenVietTien/khampha.git` | `github.com/VuNguyenVietTien/task-scheduler.git` |
| Branch/HEAD | `refactor/backend-build-optimization` @ `3c600178` (2026-07-26) | `feat/vercel-supabase-migration` @ `4057a01f`, ~2091 dirty entries (W1a/W1b/platform) |
| Cross-ref | `3c600178` KHÔNG tồn tại trong local repo; `4057a01f` KHÔNG tồn tại trong server repo | |
| Binary | `target/release/backend` (Cargo name `backend`), 50.8MB, sha256 `0f17fb7b…`, build Jul 26 | `task-scheduler-backend` (chưa build release) |
| GraphQL thực tế đang chạy | **App khampha discovery**: getNearbyStores, places, hotels, storeReviews, products… | Task-scheduler: projects/tasks/plans/comments… |
| DB | `khampha_db` — 163 bảng (users/stores/hotels/products), **KHÔNG có projects/tasks/plans/comments/notifications** | cần schema task-scheduler |

→ Triển binary task-scheduler đè lên service này sẽ: giết app khampha đang public 3 hostname, binary mới fail `Config::from_env` (thiếu toàn bộ env contract), trỏ nhầm DB. **Cần quyết định của manager trước khi deploy** (Path A/B ở §4).

## 2. Server current state

- **Host:** Ubuntu 24.04.3, x86_64, kernel 6.8; disk `/home` 364G trống. SSH qua LAN 192.168.1.5 (có cert tailscale `khampha.tail89a13f.ts.net` cho remote).
- **Unit** `/etc/systemd/system/khampha-backend.service`: `User=azuraith`, `WorkingDirectory=/home/azuraith/khampha/backend`, `ExecStart=…/target/release/backend`, `Restart=always/10s`, `Requires=docker.service`, stdout/stderr append `backend.log` (trong workdir), **không có `EnvironmentFile=`** — env nạp runtime qua dotenv `.env` → symlink `.env.ubuntu` (1.7KB, 30 keys).
- **Env keys (tên only):** `API_PORT, APPLE_BUNDLE_ID, AWS_ACCESS_KEY_ID, AWS_REGION, AWS_S3_BUCKET, AWS_SECRET_ACCESS_KEY, DATABASE_URL, DB_RETRY_ATTEMPTS, DB_RETRY_DELAY_SECS, DEPLOYMENT_LOCATION, ENVIRONMENT, FIREBASE_PROJECT_ID, FRONTEND_URL, JWT_EXPIRY, JWT_SECRET, LOCAL_STORAGE_PATH, LOG_LEVEL, MAX_REQUEST_SIZE, NOTIFICATION_SERVICE_TOKEN, NOTIFICATION_SERVICE_URL, RATE_LIMIT_BURST, RATE_LIMIT_ENABLED, RATE_LIMIT_PER_SECOND, REDIS_URL, RUST_LOG, SESSION_TIMEOUT, SHUTTLE_API_KEY, SQLX_OFFLINE, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, USE_S3_STORAGE`. Backup env cũ: `.env.ubuntu.before-redis-rotation-20260726T050028Z`.
- **Service đang chạy:** active since 2026-08-29 14:17 UTC, PID 2571, bind **0.0.0.0:8080**.
- **PostgreSQL:** container `khampha_postgres` (postgres:16-alpine, host 5433→5432, healthy). `khampha_user`/`khampha_db`. **`_sqlx_migrations` tồn tại nhưng 0 dòng** → schema khampha được import thủ công (`combined_migrations.sql`, `setup_db.sql`, các script import_wards… có trong `/home/azuraith/`), không qua sqlx runner. Ngoài ra có **native postgresql.service active trên host :5432** (khác container). `khampha_redis` publish 0.0.0.0:6379 (LAN-exposed — note hardening riêng).
- **Repo server:** `/home/azuraith/khampha/backend` — 253 file migrations domain khampha; workdir sạch trừ ~11 untracked script deploy (deploy.sh, docker-rollback.sh…). Thư mục staging binary theo convention: `/home/azuraith/khampha_backend/` (chứa `backend_new`, `backend.log` — pattern swap binary cũ).
- **cloudflared** (systemd, `/etc/cloudflared/config.yml`, tunnel `0e3b8845-7b6f-42a0-b15f-38f3ded46aff`): ingress — `ssh.khampha.dpdns.org`→ssh:22; **`api.xploria.com.vn`, `api.khampha.dpdns.org`, `khampha-backend.tienvietnam.dev` → http://localhost:8080 (cùng app khampha)**; catch-all 404.
- **Probe binary hiện tại (khampha app):** `/graphql` GET→200 (GraphiQL), POST `{__typename}`→200; `/health/live`, `/health/ready`, `/health`, `/api/v1/auth/refresh` → **404** (binary cũ chưa có platform endpoints — hợp lệ).
- **Toolchain server:** `~/.cargo`, `~/.rustup` tồn tại cho user `azuraith` nhưng không trong non-login PATH (cần `bash -lc`). **sudo cần password** (passwordless: NO).

## 3. Local state

- macOS **Darwin arm64**, **không có Docker local**, chưa có `target/release/task-scheduler-backend` → **không thể build Linux x86_64 binary trực tiếp trên Mac**. Phương án build xem §4.1.
- Dirty tree chờ reviewer ACCEPT (gate trước mọi bước deploy).

## 4. Deploy checklist (chỉ chạy SAU reviewer ACCEPT + manager quyết Path)

### Quyết định bắt buộc trước (blockers)

1. **Target mismatch (§1):** chọn Path A (song song, khuyến nghị) hay Path B (thay thế khampha app — phá sản phẩm legacy, cần phê duyệt tường minh).
2. **Build nguồn:** máy local là ARM Mac không Docker → build **trên server** bằng toolchain azuraith (repo khampha đã kéo được từ github qua ssh key → github access OK) hoặc CI. Không cross-compile local.
3. **Migration policy:** xem §5 — **tuyệt đối không** chạy sqlx chain (bị lỗi thứ tự trên DB rỗng, đã ghi nhận trong `herdr-260831-backend-platform-hardening.md`); không bao giờ chạy bất cứ migration nào vào `khampha_db`.

### Path A — Khuyến nghị: service song song `task-scheduler-backend.service` (zero-risk với khampha app)

**A0. Điều kiện:** local tree đã ACCEPT; chọn port backend mới (đề xuất **8081**, 8080 đang bị chiếm); chọn nguồn DB (đề xuất: container postgres riêng `task_scheduler_postgres` host 5434→5432, hoặc dùng native postgres host :5432 tạo db riêng — manager chọn).

**A1. Chuyển source (không qua git pull vì worktree dirty):**
```bash
# Local (Mac): đóng gói source bỏ target/node_modules
cd /Users/TienVNV/Desktop/ProjectManager
tar --exclude='backend/target' --exclude='**/node_modules' --exclude='.git' \
    -czf /tmp/task-scheduler-src.tgz backend
scp /tmp/task-scheduler-src.tgz u:/home/azuraith/task-scheduler-src.tgz
# Server
ssh u 'mkdir -p ~/task-scheduler && tar -xzf ~/task-scheduler-src.tgz -C ~/task-scheduler'
```

**A2. Build trên server (bash -lc để có cargo):**
```bash
ssh u 'bash -lc "cd ~/task-scheduler/backend && SQLX_OFFLINE=true cargo build --release && sha256sum target/release/task-scheduler-backend"'
```
Ghi lại sha256 build để đối chiếu sau transfer/backup (nếu build ngay trên server thì bỏ bước transfer riêng).

**A3. Tạo DB task-scheduler (chưa migrate — xem §5):**
```bash
ssh u 'docker run -d --name task_scheduler_postgres -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<pw> -e POSTGRES_DB=<db> \
  -p 127.0.0.1:5434:5432 --restart unless-stopped postgres:16-alpine'
# tạo .env riêng cho task-scheduler (KEY NAMES bắt buộc):
# APP_ENV=production SERVER_HOST=127.0.0.1 SERVER_PORT=8081
# DATABASE_URL=... JWT_SECRET=<32+> AUTH_SECRET=<32+, khác JWT_SECRET>
# FRONTEND_ORIGINS=https://<frontend-domain> RUN_MIGRATIONS=false
# (không đặt giá trị vào report này; điền runtime từ secret store)
```

**A4. Unit file mới** `/etc/systemd/system/task-scheduler-backend.service` (cần sudo password):
```ini
[Unit]
Description=Task Scheduler Backend (Rust)
After=network-online.target docker.service
Wants=network-online.target
[Service]
Type=simple
User=azuraith
WorkingDirectory=/home/azuraith/task-scheduler/backend
EnvironmentFile=/home/azuraith/task-scheduler/backend/.env.production
ExecStart=/home/azuraith/task-scheduler/backend/target/release/task-scheduler-backend
Restart=always
RestartSec=10
StandardOutput=append:/home/azuraith/task-scheduler/backend/backend.log
StandardError=append:/home/azuraith/task-scheduler/backend/backend.log
[Install]
WantedBy=multi-user.target
```
```bash
ssh u 'sudo systemctl daemon-reload && sudo systemctl enable --now task-scheduler-backend.service'
```
Lưu ý: dùng `EnvironmentFile` (không dựa dotenv cwd như unit cũ — rõ ràng hơn; config mới đọc env từ process).

**A5. Cloudflared ingress cho hostname task-scheduler (chỉ khi cần public ngay; sửa server — làm ở bước deploy, không phải preflight):** thêm entry `- hostname: <api-domain> / service: http://localhost:8081` **trên** catch-all 404 trong `/etc/cloudflared/config.yml` → `sudo systemctl restart cloudflared`. DNS record tương ứng bên Cloudflare. (Đến lúc này mới đụng cloudflared — 3 hostname hiện tại không đổi.)

**A6. Smoke (local trên server):**
```bash
curl -s http://127.0.0.1:8081/health/live        # 200 {"status":"live","database":"unchecked"}
curl -s http://127.0.0.1:8081/health/ready       # 200 ready/up (hoặc 503 nếu DB chưa migrate-schemasafe)
curl -s -X POST -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}' http://127.0.0.1:8081/graphql   # 200
curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8081/api/v1/auth/refresh                          # 401 (route mounted, thiếu credential) — 404 = lỗi mount
curl -s -o /dev/null -w '%{http_code}\n%header{access-control-allow-origin}' -X OPTIONS \
  -H 'Origin: https://<frontend-domain>' -H 'Access-Control-Request-Method: POST' http://127.0.0.1:8081/graphql   # 200 + ACAO exact
# Public (sau A5): curl https://<api-domain>/health/live
```

**A7. Rollback Path A (an toàn tuyệt đối — không ảnh hưởng khampha app):**
```bash
ssh u 'sudo systemctl disable --now task-scheduler-backend.service'   # dừng + bỏ autostart
# (tùy chọn) docker stop task_scheduler_postgres
# cloudflared: bỏ entry ingress vừa thêm (nếu đã làm A5) + restart cloudflared
```
Không có rollback DB vì policy §5 không chạy migration tự động ở lần deploy này.

### Path B — CHỈ SAU PHÊ DUYỆT TƯỜNG MINH: thay thế khampha-backend.service bằng task-scheduler

**B1. Backup đầy đủ trước khi đụng gì:** `cp -a target/release/backend ~/backups/backend.<sha8>.$(date -u +%Y%m%dT%H%M%SZ)`; `cp -a .env.ubuntu ~/backups/`; `cp -a /etc/systemd/system/khampha-backend.service ~/backups/`; `docker exec khampha_postgres pg_dump -U khampha_user khampha_db | gzip > ~/backups/khampha_db.$(date…).sql.gz` (dump read-only, ~163 bảng).
**B2. Stage + swap binary theo convention sẵn có:** upload vào `~/khampha_backend/task-scheduler-backend.new` → `mv target/release/backend backend.khampha.old && mv ~/khampha_backend/task-scheduler-backend.new target/release/task-scheduler-backend`.
**B3. Sửa unit:** `ExecStart` trỏ `task-scheduler-backend`, thêm `EnvironmentFile` (contract mới: APP_ENV/DATABASE_URL(task-scheduler DB mới)/JWT_SECRET/AUTH_SECRET/FRONTEND_ORIGINS/RUN_MIGRATIONS=false, SERVER_PORT giữ 8080). `systemctl daemon-reload && sudo systemctl restart khampha-backend`.
**B4. Smoke:** như A6 nhưng :8080; thêm kiểm tra 3 hostname cloudflared hiện tại giờ trỏ task-scheduler (lưu ý user cũ của app khampha sẽ mất dịch vụ — đây là lý do phải phê duyệt).
**B5. Rollback:** `mv` lại `backend.khampha.old` → `backend`, khôi phục `.env.ubuntu` + unit backup, `daemon-reload`, `restart`. DB khampha không bị ghi bởi binary mới (DATABASE_URL khác) nhưng vẫn giữ pg_dump làm bằng chứng.

## 5. Migration policy (bắt buộc đọc trước khi bật bất kỳ migration nào)

1. **Không chạy sqlx chain vào `khampha_db`** — schema khác dòng sản phẩm (stores/hotels vs projects/tasks); `_sqlx_migrations` của khampha_db trống vì họ import thủ công.
2. **DB task-scheduler rỗng cũng CHƯA chạy được chain sqlx** — lỗi thứ tự version: `20230705000001_create_plans_table` và `20240616000001_create_reports_tables` (REFERENCES projects/users/plans/tasks) chạy **trước** `20250319000000_create_initial_schema` (nơi tạo các bảng đó) → fail tại migration đầu trên DB rỗng. (Chi tiết trong `plans/reports/herdr-260831-backend-platform-hardening.md` §1.6.)
3. **Hành động đúng cho lần deploy này:** giữ `RUN_MIGRATIONS=false`; khởi tạo schema task-scheduler bằng một trong: (a) fix/reorder chain trong repo (repo-side, sau ACCEPT, DB-owner quyết — renumber hoặc bridge migration), rồi chạy `cargo run --bin migrate` trên DB mới; hoặc (b) apply thủ công theo đúng thứ tự logic (20250319 → 20230705 → 20240616 → phần còn lại ascending) + ghi `_sqlx_migrations` tương ứng. Mặc định khuyến nghị (a) để chain sqlx về chuẩn.
4. Sau migrate: `curl /health/ready` phải 200 trước khi mở ingress public.

## 6. Đã KHÔNG làm (tuân thủ ràng buộc)

Không deploy/restart/stop service nào; không sửa file, không tạo/đổi DB, không rotate secret, không commit/push; cloudflared/config.yml chỉ đọc grep ingress; tất cả query Postgres là SELECT/EXISTS/count; GraphQL POST chỉ `{__typename}` (read-only introspection).

## 7. Open questions cho manager

1. Chọn Path A hay B (§1 là blocker quyết định)?
2. DB task-scheduler: container riêng (5434) hay native postgres host :5432? Ai là DB-owner fix migration chain (§5.3a)?
3. Hostname public mới cho task-scheduler API (3 hostname cloudflared hiện tại thuộc khampha app)?
4. Path B nếu chọn: xác nhận kế hoạch ngừng phục vụ app khampha trên 3 hostname + thời điểm.
5. Server `cargo` version chưa xác minh (non-login PATH trống) — xác minh `bash -lc 'rustc --version'` trước A2; nếu toolchain cũ quá so với edition/Cargo.toml thì cập nhật toolchain ở bước deploy (server-side change).
