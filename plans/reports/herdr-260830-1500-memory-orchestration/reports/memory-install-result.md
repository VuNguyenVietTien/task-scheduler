# ProjectManager — Memory Stack Implementation Result
**Ngày:** 2026-08-30 · **Phạm vi được duyệt:** install gitnexus (node24, pin) + pi-gitnexus (project-local) + mempalace 3.8.0 + `.mcp.json` + `.pi/settings.json` (qua pi install) + `.agents/skills/pm-project-memory/SKILL.md` + artifacts ngoài tracked source. **Không commit/push/deploy. Không auth/mutate Supabase.**

> ⚠️ **GITNEXUS POLYFORM NONCOMMERCIAL CAVEAT (prominent, per approval):** stack này dùng
> **gitnexus@1.6.10 — PolyForm Noncommercial 1.0.0** cho mục đích **cá nhân/nội bộ,
> phi thương mại** của ProjectManager. **Không có bất kỳ quyền thương mại nào được cấp.**
> Trước khi thương mại hóa: gỡ GitNexus (Rollback §8) và thay bằng Graphify (Apache-2.0)
> hoặc mua license Akon Labs.

## 1. Kết quả tổng quan — TẤT CẢ steps ĐẠT

| Step | Kết quả | Bằng chứng chính |
|---|---|---|
| 1. Backups ngoài repo | ✅ | `~/backups-pm-memory/`: palace 556K (6 files), mcp.json, pi-settings.json (TS=20260830-222155); không tồn tại `~/.mempalace/config.json` (mempalace dùng default + repo `mempalace.yaml`) |
| 2. gitnexus pin node24 | ✅ | `npm install -g gitnexus@1.6.10` dưới v24.13.0, `SCARF_ANALYTICS=false`, `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1`, **không chạy setup**; 255 packages/33s; `gitnexus --version` = 1.6.10; doctor: LadybugDB native ✓ |
| 3. Zero-mutation proof | ✅ | Scratch clone: `git status` **trống**, diff rỗng, AGENTS/CLAUDEMd untouched, `~/.claude/settings.json` sha256 **không đổi**, 0 gitnexus skills global. Repo thật: git status **identical** 1965=1965 dòng trước/sau analyze |
| 4. `.mcp.json` + gitnexus stdio | ✅ | servers = `['mempalace','supabase','gitnexus']`; diff vs backup = **chỉ** block gitnexus; JSON valid; mempalace + supabase **nguyên vẹn byte-identical** |
| 5. pi-gitnexus@0.6.4 project-local | ✅ (gate PASSED) | `pi install -l npm:pi-gitnexus@0.6.4`; `pi list` = 2 packages; proof end-to-end: augment trả graph thật dưới node pi v23.8.0 |
| 6. mempalace 3.8.0 | ✅ | `uv tool install --force mempalace==3.8.0`; status = 8 drawers/2 wings **nguyên vẹn**; search trả kết quả cosine+bm25 → **không rollback** |
| 7. Skill pm-project-memory | ✅ | `.agents/skills/pm-project-memory/SKILL.md` — **155 dòng** (<300), đủ: 3 layers, khi search/wake-up/mine, freshness, no-secrets, prompt-injection + exfiltration defense, no-auto-source-edits, license warning đầu file |
| 8. Adapter/MCP validation | ✅ | Loader adapter: `shared-project` exists=true **servers=3**; gitnexus MCP stdio handshake: initialize OK + **17 tools**; Supabase **chỉ validate config** (url identical vs backup, không connect) |

## 2. Chi tiết & bằng chứng từng step

### Step 1 — Backups (`~/backups-pm-memory/`, TS=20260830-222155)
```
palace.bak-20260830-222155   556K (6 files: chroma.sqlite3, knowledge_graph.sqlite3[+wal/shm], HNSW bins, collection dir)
mcp.json.bak-20260830-222155 4.0K
pi-settings.json.bak-…        4.0K
```
Baseline bổ sung cho proof: `/tmp/pm_gitstatus_before.txt` (1965 dòng; `.mcp.json` **đã M sẵn trước phiên** — hash b10cf611…), `~/.claude/settings.json` sha256 `437ba0cc…`, `~/.claude/skills` = 114 entries.

### Step 2 — gitnexus@1.6.10 (node v24.13.0)
- PATH per-invocation `~/.nvm/versions/node/v24.13.0/bin` — **nvm default vẫn = "23"** (đọc lại sau cùng: unchanged), không sửa shell defaults.
- Install log: `added 255 packages in 33s`; postinstall build-tree-sitter-grammars chạy thành công (skip 4 optional grammars theo env).
- `gitnexus doctor`: Node v24.13.0, LadybugDB 0.19.1 native ✓, ONNX 1.29.0.
- Bin: `~/.nvm/versions/node/v24.13.0/bin/gitnexus` → symlink `../lib/node_modules/gitnexus/dist/cli/index.js`.

### Step 3 — Zero-mutation validation (`--index-only`)
- **Deviation (đã xử lý):** flag `--skip-embeddings` trong README **không tồn tại** ở CLI 1.6.10 (`error: unknown option`); embeddings là **opt-in** (`--embeddings [limit]`) nên chạy `--index-only` thuần là đúng ngữ nghĩa — không embeddings được generate.
- `--index-only` = "Pure index mode: skip all file injection (AGENTS.md, CLAUDE.md, skills)" (analyze --help).
- **Scratch clone** `/tmp/pm-scratch` (clone HEAD 4057a01): analyze 45.8s → **18,360 nodes / 30,311 edges / 406 clusters / 268 flows**. `git status --porcelain` = **EMPTY** (ngay cả `.gitnexus/` không hiện — cơ chế: gitnexus ghi `.gitnexus/` vào `.git/info/exclude` VÀ `.gitnexus/.gitignore` chứa `*`; xác minh cả hai file). `git diff` rỗng; AGENTS.md/CLAUDE.md không đổi; `~/.claude/settings.json` sha256 identical; 0 `gitnexus*` trong `~/.claude/skills` → **không hooks, không skills, không context-injection**.
- **Repo thật**: analyze 40.6s → 18,366 nodes / 30,315 edges. `git status` trước/sau **identical** (diff rỗng giữa 2 file snapshot 1965 dòng). `.gitnexus/` = 209MB (index + parse-cache).
- `gitnexus status`: indexed commit 4057a01 = HEAD; runner identity = node v24.13.0/1.6.10 với digest build; flag "stale" chỉ phản ánh working tree có thay đổi chưa commit so với HEAD (pre-existing dirt) — không phải lỗi.

### Step 4 — `.mcp.json` (file được ownership)
Entry cuối (dạng **PATH-independent** — xem rationale Step 5):
```json
"gitnexus": {
  "command": "/Users/TienVNV/.nvm/versions/node/v24.13.0/bin/node",
  "args": ["/Users/TienVNV/.nvm/versions/node/v24.13.0/lib/node_modules/gitnexus/dist/cli/index.js", "mcp"],
  "env": {"SCARF_ANALYTICS": "false"}
}
```
- Diff vs backup: **chỉ** thêm block gitnexus (+ trailing newline); `mempalace` (uv python stdio) và `supabase` (HTTP url) **giữ nguyên tuyệt đối**.
- Bản nháp đầu dùng symlink `…/bin/gitnexus` — được nâng cấp thành node24-explicit sau phân tích shebang (§Step 5) để adapter (chạy dưới node pi) spawn luôn đúng node24 bất kể PATH.

### Step 5 — pi-gitnexus@0.6.4 (gate: prove resolution)
- **Source audit** (`/tmp/audit/pg/package/dist/{gitnexus,index,mcp-client,ui/settings-menu}.js`): config `~/.pi/pi-gitnexus.json` key **`cmd`**; `resolveGitNexusCmd(flag, saved)` = `cmd.split(/\s+/)`; mọi spawn (augment/analyze/**mcp-client nội bộ của extension**) đều qua mảng này; ghi duy nhất `~/.pi/` — không ghi repo.
- **Rủi ro shebang tìm thấy:** bin là symlink tới JS `#!/usr/bin/env node` → nếu command là symlink, node thực tế = node theo PATH của process pi (v23.8.0) → ngoài engines `^22.18.0||>=24.11.0`. Test thực tế symlink vẫn chạy `--version` dưới PATH-node23, nhưng **không deterministic** theo spec engines.
- **Giải pháp đã chọn:** `cmd` = `"<node24bin> <script.js>"` (2 token) → spawn trực tiếp node24, **PATH-independent**, không đổi shell defaults của user.
- **Proof end-to-end** (chạy dưới node v23.8.0, PATH mô phỏng pi): replicate đúng logic `resolveGitNexusCmd` + `runAugment`:
  ```
  exit: 0 | augment stderr length: 140
  [GitNexus] 1 related symbols found:
  verify_access_token (backend/src/auth/token.rs)
    Called by: get_auth_info_from_token, call, validator
  ```
  → Extension resolve node24 binary **đáng tin cậy** → gate PASSED → install.
- `pi install -l npm:pi-gitnexus@0.6.4` → `.pi/settings.json` = `["npm:pi-mcp-adapter@2.31.0","npm:pi-gitnexus@0.6.4"]`; `pi list` xác nhận 2 packages project-scope; 0 vulnerabilities.
- Ghi chú: lần import trực tiếp `dist/gitnexus.js` bằng node thuần lỗi `ERR_MODULE_NOT_FOUND` (specifier không `.js`) — là hạn chế của test harness ESM, không phải lỗi extension (pi load qua loader riêng); proof bằng replication spawn path như trên.

### Step 6 — mempalace 3.3.0 → 3.8.0
- `uv tool install --force mempalace==3.8.0` (pin) → `MemPalace 3.8.0`; cài thêm exe `mempalace-mcp`; venv path không đổi → entry `.mcp.json` (python3.13 `-m mempalace.mcp_server`) **vẫn đúng, không sửa**.
- `mempalace status`: **8 drawers, 2 wings** (share-and-remind/decisions; wing_claude-code/diary) = dữ liệu cũ nguyên vẹn → **không data failure, không rollback**.
- `mempalace search "enum mismatch uppercase"`: trả 2+ hits kèm cosine_sim/bm25 → retrieval hoạt động.
- Warning duy nhất (advisory, không fatal): `EmbedderIdentityUnknownWarning` — palace chưa ghi embedder identity, hệ thống giả định `minilm` (trùng default lịch sử) → hành vi không đổi. Tùy chọn sau: `mempalace palace set-embedder --model minilm` để ghi nhận (không chạy để giữ minimal-intervention).

### Step 7 — Skill `pm-project-memory`
- `.agents/skills/pm-project-memory/SKILL.md`, **155 dòng**, frontmatter đồng bộ format skill hiện có (name/description/license/metadata).
- Nội dung bắt buộc: 3-layer table + decision rules; lệnh GitNexus chính xác (nhấn mạnh **luôn `--index-only`**, cấm `gitnexus setup`, binary node24 chỉ định); lệnh MemPalace (wake-up/search/mine/status); freshness contract; **no-secrets**; **prompt-injection defense** (data-vs-instructions, escalate); **data-exfiltration defense** (không remote embeddings, không upload artifacts, Supabase MCP không bao giờ auth/mutate bởi memory flows); **no-automatic-source-edits**; rollback exact; quick reference card. License warning đặt ở đầu file.

### Step 8 — Validation (không auth/mutate Supabase)
- **Adapter loader** (gọi `getMcpStandardConfigSummary` từ `.pi/npm/node_modules/pi-mcp-adapter/dist/config.js`, cwd=repo):
  ```
  shared-project  exists=true  servers=3   ← root .mcp.json (mempalace, supabase, gitnexus)
  (các nguồn global = false/0)
  ```
- **gitnexus MCP stdio handshake** (spawn đúng command/args từ `.mcp.json`, JSON-RPC):
  ```
  server: {"name":"gitnexus","version":"1.6.10"} | initialize ok
  tools (17): list_repos, query, cypher, context, detect_changes, check, rename,
              impact, explain, pdg_query, route_map, tool_map, shape_check,
              api_impact, group_list, group_sync, trace
  ```
- **Supabase**: chỉ bằng chứng config-level — entry + url identical với backup (diff §Step 4); **không** initialize/connect/auth.
- **Housekeeping:** scratch `/tmp/pm-scratch` đã `gitnexus clean` + xóa; registry còn đúng 1 repo (`task-scheduler` @ /Users/TienVNV/Desktop/ProjectManager, 18,366 symbols / 30,315 edges).

## 3. Final state (delta so với baseline đầu phiên)
- Repo tracked/untracked: **duy nhất 1 dòng mới** `?? .agents/skills/pm-project-memory/` (skill được cấp ownership). `.gitnexus/` tự-ignore (không hiện status). `.pi/` nguyên trạng untracked từ trước (nay chứa thêm pi-gitnexus bên trong). `.mcp.json` vẫn M như baseline (delta nội dung = block gitnexus, đã chứng minh bằng diff backup).
- `~/.claude/settings.json` sha256 **không đổi** suốt phiên; `~/.claude/skills` không có gitnexus entries; **0 hooks** được đăng ký ở bất kỳ đâu.
- nvm default = "23" (không đổi). Không file global shell nào được sửa.
- Artifacts tạo mới (ngoài tracked source): `~/backups-pm-memory/*`, `.gitnexus/` (209MB, self-ignored), `~/.gitnexus/registry.json` + config, `~/.pi/pi-gitnexus.json`, node24 global package gitnexus@1.6.10, uv tool mempalace 3.8.0, `.pi/npm/node_modules/pi-gitnexus`.

## 4. Cách dùng (day-2 operations)
```bash
# session start (bất kỳ agent đọc skill): mempalace wake-up
# code graph query: ~/.nvm/versions/node/v24.13.0/bin/gitnexus query|impact|context|trace "<symbol>"
# sau khi code đổi: ~/.nvm/versions/node/v24.13.0/bin/gitnexus analyze --index-only   (rồi git status — kỳ vọng không entry mới)
# cuối session: mempalace mine .
# trong pi: extension pi-gitnexus tự enrich read/grep (config ~/.pi/pi-gitnexus.json); MCP "gitnexus" tự sẵn qua pi-mcp-adapter từ .mcp.json
```

## 5. Deviations & notes
1. `--skip-embeddings` (README) không có trong CLI 1.6.10 → embeddings mặc định OFF; dùng `--index-only` thuần. Đã xác minh qua `analyze --help`.
2. `.mcp.json` gitnexus entry nâng cấp từ symlink → node24-explicit vì shebang `env node` (lý do engines/PATH — phân tích ở Step 5).
3. MemPalace `EmbedderIdentityUnknownWarning` — advisory; giả định `minilm` = default lịch sử; không can thiệp.
4. pi-gitnexus import-test ESM thuần fail (specifier không `.js`) — thay bằng replication spawn-path (chính xác theo source đã audit).
5. gitnexus đăng ký repo dưới tên "task-scheduler" (tên từ package/origin) — cosmetic; path đúng ProjectManager.

## 6. Verification matrix (đã thực thi)
| Kiểm tra | Kỳ vọng | Kết quả |
|---|---|---|
| `gitnexus --version` dưới node24 | 1.6.10 | ✅ |
| Scratch `git status` sau analyze --index-only | rỗng | ✅ EMPTY |
| Repo thật git status trước/sau | identical | ✅ 1965=1965, diff rỗng |
| `~/.claude/settings.json` sha256 | không đổi | ✅ (3 lần kiểm) |
| gitnexus skills/hooks global | 0 | ✅ |
| `.mcp.json` servers | mempalace+supabase preserved, +gitnexus | ✅ diff minh bạch |
| JSON validity `.mcp.json` | valid | ✅ |
| pi-gitnexus augment dưới node pi | graph trả kết quả | ✅ exit 0, 1 symbol + callers |
| mempalace status/search sau upgrade | data nguyên vẹn + retrieval | ✅ 8 drawers; hits trả về |
| Adapter discovery | shared-project=3 servers | ✅ |
| gitnexus MCP tools/list | >0 tools | ✅ 17 tools |
| nvm default | "23" (không đổi) | ✅ |
| Supabase | không auth/mutate | ✅ config-only |

## 7. Risks còn lại
- **PolyForm Noncommercial** (§ đầu file) — ràng buộc vĩnh viễn cho layer L2 cho đến khi thay thế.
- Index 209MB trong repo dir (self-ignored) — thêm vào backup/disk planning; có thể `gitnexus clean` + re-analyze bất cứ lúc nào.
- pi-gitnexus enrich mỗi read/grep có timeout 8s mặc định + max output 8K chars (built-in guards) — token overhead nhỏ, đã bounded.
- gitnexus "stale" flag khi working tree ≠ HEAD — thao tác chuẩn: re-run `analyze --index-only`.

## 8. Rollback (exact, đã nghiệm trong audit)
```bash
TS=20260830-222155
# L2 GitNexus
~/.nvm/versions/node/v24.13.0/bin/gitnexus uninstall --force || true
~/.nvm/versions/node/v24.13.0/bin/npm rm -g gitnexus
rm -rf /Users/TienVNV/Desktop/ProjectManager/.gitnexus ~/.gitnexus
pi remove -l npm:pi-gitnexus; rm -f ~/.pi/pi-gitnexus.json
cp ~/backups-pm-memory/mcp.json.bak-$TS /Users/TienVNV/Desktop/ProjectManager/.mcp.json
cp ~/backups-pm-memory/pi-settings.json.bak-$TS /Users/TienVNV/Desktop/ProjectManager/.pi/settings.json
# L3 MemPalace (chỉ khi data failure)
uv tool install --force mempalace==3.3.0
rm -rf ~/.mempalace/palace && cp -a ~/backups-pm-memory/palace.bak-$TS ~/.mempalace/palace
# Skill
rm -rf /Users/TienVNV/Desktop/ProjectManager/.agents/skills/pm-project-memory
```

*Không commit/push/deploy. Không thay đổi shell defaults. Supabase không được auth/mutate. Báo cáo: /tmp/projectmanager-memory-install-result.md*
