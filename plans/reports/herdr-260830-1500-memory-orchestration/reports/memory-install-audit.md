# ProjectManager — Supply-chain & Install Audit (gitnexus · pi-gitnexus · mempalace)
**Ngày:** 2026-08-30 · **Vai trò:** read-only · **Không cài, không sửa file.**
**Correction từ review đã tiếp nhận:** pi **có** MCP — project-local `pi-mcp-adapter@2.31.0` (`.pi/settings.json`: `{"packages":["npm:pi-mcp-adapter@2.31.0"]}`) đọc root `.mcp.json` (`dist/config.js:17` `PROJECT_CONFIG_NAME=".mcp.json"`). Bằng chứng runtime: `~/.pi/agent/mcp-cache.json` đang expose **29 tools** của server `mempalace` → pipeline `.mcp.json → adapter → pi` đã hoạt động. Kết luận "Pi không load .mcp.json" trong báo cáo trước **sai**, bị rút lại.

---

## 1. Phương pháp audit
- npm registry JSON: `registry.npmjs.org/{gitnexus,pi-gitnexus,pi-mcp-adapter}` (metadata, scripts, engines, deps, tarball URL).
- Tarball download + extract tới `/tmp/audit/` (KHÔNG npm install): đọc `package.json`, postinstall script gốc, grep dist cho storage/telemetry/write paths.
- PyPI JSON `pypi.org/pypi/mempalace/json` (3.8.0: wheel + sdist, requires_dist) + CHANGELOG gốc (raw GitHub, 755 dòng) cho 3.3.0→3.8.0.
- Local: `.pi/`, `~/.pi/agent/`, `~/.mempalace/`, nvm node versions, GitNexus README (đã fetch /tmp).

## 2. Kết quả audit từng package

### 2.1 gitnexus @ 1.6.10 (npm)
| Mục | Kết quả | Evidence |
|---|---|---|
| License | **PolyForm-Noncommercial-1.0.0** (SPDX) | registry + tarball package.json |
| Entry point | `bin: gitnexus → dist/cli/index.js` (Node CLI thuần + native addons) | package.json |
| **Node engines** | `^22.18.0 \|\| >=24.11.0` — **node mặc định máy là v23.8.0 → KHÔNG thỏa**; đã có sẵn **v24.13.0** trong nvm ✅ | package.json; `ls ~/.nvm/versions/node` = v20.11.1, v23.8.0, v24.13.0 |
| Install scripts | **postinstall:** `node scripts/build-tree-sitter-grammars.cjs` — đã đọc toàn bộ 126 dòng: build vendored grammars **in-place dưới `vendor/`**, ưu tiên **prebuilds đi kèm** (6 platform tuples → thường KHÔNG cần C++ toolchain), `tree-sitter-c` bắt buộc, dart/proto/swift/kotlin bỏ qua được bằng `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1`, **không bao giờ throw**. `prepare`/`prepack` không chạy từ registry tarball. **Không network trong postinstall** | `/tmp/audit/gx/package/scripts/build-tree-sitter-grammars.cjs` |
| Optional deps | `onnxruntime-node`, `@huggingface/transformers` (embeddings; install fail được dung thứ; onnxruntime postinstall có thể tải binary CUDA từ nuget — tránh bằng `ONNXRUNTIME_NODE_INSTALL=skip` hoặc chấp nhận vì là optional) | package.json.optionalDependencies + README #2370 |
| **Telemetry** | Dependency `@scarf/scarf@^1.4.0` — install analytics. **Opt-out: `SCARF_ANALYTICS=false`** (khuyến nghị set khi install) | package.json.dependencies |
| Native requirements | `tree-sitter` + grammars (rust, typescript, go, java, python, javascript, ruby, php, cpp, c-sharp) là deps chính có prebuilds; `node-addon-api`+`node-gyp-build`; vendor/ có 5 grammar (c, dart, proto, swift, kotlin) + binding.gyp | tarball file listing |
| Index storage | **Per-repo `.gitnexus/`** + global `~/.gitnexus/registry.json`, `~/.gitnexus/config.json`. Code tự giữ `.gitnexus/` được ignore "without editing the user's root .gitignore" | dist/cli/index.js:64,128; dist/core/run-analyze.js:2932 |
| **Mutation behavior** | `analyze` mặc định: tạo/sửa block **AGENTS.md/CLAUDE.md**, install skills vào `.claude/skills/`+`.agents/skills/`, **đăng ký Claude Code hooks** (file user-global `~/.claude/settings.json`). `setup`: ghi **MCP config global** cho editors phát hiện được. **Cách vô hiệu hóa:** flag `--skip-agents-md` (chỉ AGENTS/CLAUDE), `--skip-skills`, và **`--index-only` = mạnh nhất — "skips all file injection"**; persistent qua `.gitnexusrc` keys `skipContextFiles`/`skipSkills`/`indexOnly` | README L60, L221-223, L410, L444-446, L500-517 |
| Supply-chain verdict | 🟡 Chấp nhận được với 3 điều kiện: (1) chạy dưới node ≥24.11; (2) set `SCARF_ANALYTICS=false`; (3) pin version. CI + OpenSSF Scorecard + SECURITY.md có sẵn | README badges |

### 2.2 pi-gitnexus @ 0.6.4 (npm)
| Mục | Kết quả | Evidence |
|---|---|---|
| License / tác giả | **MIT**, tintinweb (security researcher) | package.json |
| Scripts | **Không có install/postinstall** (chỉ build/lint/test) → không chạy code nào lúc cài | package.json.scripts |
| Dependencies | Đúng **1**: `cross-spawn@7.0.6`. peerDeps: `@earendil-works/{pi-ai,pi-coding-agent,pi-tui}>=0.74`, `typebox>=1.0` | package.json |
| pi manifest | `extensions: [./src/index.ts]`, `skills: [./skills]` (4 skill: exploring, debugging, refactoring, pr-review) | package.json.pi |
| Write behavior (audit dist) | Ghi **duy nhất** config vào `~/.pi/...` (`mkdirSync(join(homedir(),'.pi'))`, `writeFileSync(CONFIG_PATH)`) — **không ghi file trong repo**. Tương tác gitnexus qua `spawn/execFile` CLI (9 chỗ) + MCP client | dist/gitnexus.js:2,33-34 |
| Yêu cầu runtime | `gitnexus >= 1.4.8` trên PATH; index đã có (chạy `/gitnexus analyze`) | README |
| Project-local install | `pi install -l npm:pi-gitnexus@0.6.4` → ghi `.pi/settings.json` + `.pi/npm/node_modules/` (cơ chế đã được chứng minh bởi pi-mcp-adapter đang nằm đúng chỗ đó) | docs/packages.md: "Use `-l` to write to project settings (`.pi/settings.json`)" |
| Verdict | 🟢 **SAFE cho project-local** — footprint: 1 dòng trong `.pi/settings.json` + node_modules dưới `.pi/npm/` (nên gitignore), config runtime ở `~/.pi/` | |

### 2.3 mempalace 3.3.0 → 3.8.0 (PyPI/uv)
| Mục | Kết quả | Evidence |
|---|---|---|
| Package | Wheel pure-python 755 KB (`py3-none-any`), **không install script** (wheel chuẩn pip không chạy arbitrary code lúc cài); sdist 25 MB | PyPI JSON releases[3.8.0] |
| Deps chính | `chromadb>=1.5.4,<2`, `huggingface-hub`, `tokenizers`, `numpy`, `pyyaml` (onnxruntime chỉ ở extra `coreml`) — model embedding tải lần đầu chạy, lưu cache local | requires_dist |
| License / health | MIT, ⭐58.7k, push 2026-08-28 | GitHub API |
| **Thay đổi 3.4→3.8 ảnh hưởng upgrade** | (a) 3.7.1: chromadb reconnect **không rewind HNSW** nữa; partial-mine retry được; writer lease SIGTERM. (b) 3.8.0: `sqlite_exact` thêm **VIRTUAL generated columns + index — migration tự chạy ở lần mở writable đầu tiên** (walk metadata 1 lần, không copy bảng; read-only open fallback `json_extract`). (c) 3.8.0: fix **CoreML NaN/zero-vector trên Apple Silicon** (relevant — máy là macOS ARM). (d) `sync --apply` không còn xóa drawer khi nguồn unreadable. (e) perf lớn: `list_drawers` 36.6s→0.01s, search 6.4s→0.2-1.6s | CHANGELOG.md #2313, #2283, #2320, #2314, #2308 |
| Rủi ro upgrade | SQLite schema migration (b) là **one-way** trên palace hiện có → **backup palace bắt buộc trước**. Nhảy 3.3→3.8 có thể cần `mempalace migrate` (hỗ trợ chroma 3.0.0→3.1.0) và/hoặc `mempalace repair` (rebuild vector index) | README + `mempalace --help` |
| Verdict | 🟢 Nên upgrade (fix dữ liệu + perf + fix macOS), điều kiện backup trước | |

---

## 3. Exact project-scope install/config plan (CHƯA chạy — chỉ kế hoạch)

### Bước 0 — Backup (bắt buộc, trước mọi thứ)
```bash
TS=$(date +%Y%m%d-%H%M%S)
cp -a ~/.mempalace/palace ~/palace.bak-$TS            # chroma + kg sqlite + HNSW bins
cp ~/.mempalace/config.json ~/mempalace-config.bak-$TS 2>/dev/null || true
cp /Users/TienVNV/Desktop/ProjectManager/.mcp.json ~/.mcp.json.bak-$TS
cp /Users/TienVNV/Desktop/ProjectManager/.pi/settings.json ~/pi-settings.bak-$TS
cp ~/.claude/settings.json ~/claude-settings.bak-$TS   # để diff phát hiện hooks do gitnexus ghi
du -sh ~/palace.bak-$TS                                 # xác nhận backup nguyên vẹn
```
(`mempalace.yaml` đã được git track trong repo — an toàn mặc định.)

### Bước 1 — gitnexus dưới Node 24 (engines ^22.18 || >=24.11)
```bash
nvm use 24.13.0                       # KHÔNG dùng v23.8.0 mặc định
export SCARF_ANALYTICS=false          # tắt install telemetry
npm install -g gitnexus@1.6.10        # pin exact
~/.nvm/versions/node/v24.13.0/bin/gitnexus --version   # verify
```
- Không cần C++ toolchain (prebuilds đi kèm). Muốn cài nhanh/tối giản: thêm `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1` (mất parse dart/proto/swift/kotlin — không cần cho repo này).

### Bước 2 — Index KHÔNG sửa tracked files
**Pre-flight zero-risk (khuyến nghị):** chạy thử trong clone scratch:
```bash
git clone /Users/TienVNV/Desktop/ProjectManager /tmp/pm-scratch
cd /tmp/pm-scratch && ~/.nvm/versions/node/v24.13.0/bin/gitnexus analyze --index-only --skip-embeddings
git -C /tmp/pm-scratch status --porcelain | grep -v '.gitnexus'   # kỳ vọng: EMPTY (không tracked file đổi)
diff ~/.claude/settings.json ~/claude-settings.bak-$TS            # kỳ vọng: không khác (không hooks)
```
**Trên repo thật:**
```bash
cd /Users/TienVNV/Desktop/ProjectManager
gitnexus analyze --index-only --skip-embeddings   # indexOnly = skip TOÀN BỘ file injection (AGENTS/CLAUDE/skills/hooks)
git status --porcelain                            # kỳ vọng: chỉ '.gitnexus/' untracked
diff ~/.claude/settings.json ~/claude-settings.bak-$TS   # kỳ vọng: không hooks được ghi
# Embeddings (optional, sau này): gitnexus analyze --embeddings  — dùng ONNX local
```
Ghi chú: index nằm tại `<repo>/.gitnexus/` (tự-ignore nội bộ, không đụng `.gitignore` gốc) + registry `~/.gitnexus/registry.json`. Nếu muốn lock hành vi vĩnh viễn trong repo: tạo `.gitnexusrc` `{"indexOnly": true}` (file mới, untracked hoặc commit tùy ý).

### Bước 3 — GitNexus stdio MCP vào `.mcp.json` hiện có (qua pi-mcp-adapter)
Sửa root `.mcp.json` — thêm vào cạnh `mempalace`/`supabase`:
```json
"gitnexus": {
  "command": "/Users/TienVNV/.nvm/versions/node/v24.13.0/bin/gitnexus",
  "args": ["mcp"]
}
```
- Dùng **absolute path node-24** vì engines chặn node 23.8.0 mặc định trong PATH khi adapter spawn.
- Biến thể portable (nếu mọi client đều chạy dưới node ≥24): `"command": "gitnexus", "args": ["mcp"]`.
- **Không chạy `gitnexus setup`** — nó ghi MCP config global + hooks cho editors; .mcp.json thủ công là đủ và project-scope.
- Adapter tự pick server mới ở phiên pi kế tiếp (cơ chế giống mempalace đang chạy — evidence mcp-cache.json).

### Bước 4 — pi-gitnexus project-local
```bash
cd /Users/TienVNV/Desktop/ProjectManager
pi install -l npm:pi-gitnexus@0.6.4        # -l = project settings .pi/settings.json
pi list                                     # kỳ vọng: pi-mcp-adapter@2.31.0 + pi-gitnexus@0.6.4
```
- Git hygiene: `.pi/` hiện **chưa được ignore** và đang untracked. Đề xuất (khi được sửa): commit `.pi/settings.json` (55B, chia sẻ setup), thêm `.pi/npm/` vào `.gitignore`.
- Trong pi: chạy `/gitnexus analyze` nếu index chưa có; extension tự enrich read/grep/find/bash.

### Bước 5 — mempalace upgrade (đã backup ở Bước 0)
```bash
uv tool upgrade mempalace                    # 3.3.0 → 3.8.0 (pin: uv tool install --force mempalace==3.8.0)
mempalace --version
mempalace status                             # nếu lỗi chroma version → mempalace migrate
# KHÔNG chạy repair rebuild-index trừ khi status/search báo hỏng (3.8.0 đã fix zero-vector detection)
mempalace search "enum mismatch"             # smoke test dữ liệu cũ còn tìm được
```
- `.mcp.json` của mempalace trỏ tới `/Users/TienVNV/.local/share/uv/tools/mempalace/bin/python3.13` — path **không đổi** sau upgrade, không cần sửa config.

---

## 4. Rollback (exact)
```bash
# gitnexus
~/.nvm/versions/node/v24.13.0/bin/gitnexus uninstall --force   # gỡ MCP/skills/hooks (nếu có)
npm rm -g gitnexus
rm -rf /Users/TienVNV/Desktop/ProjectManager/.gitnexus ~/.gitnexus
# xóa entry "gitnexus" khỏi .mcp.json (khôi phục từ ~/.mcp.json.bak-$TS)

# pi-gitnexus
pi remove -l npm:pi-gitnexus            # bỏ khỏi .pi/settings.json
rm -rf /Users/TienVNV/Desktop/ProjectManager/.pi/npm/node_modules/pi-gitnexus

# mempalace (kèm dữ liệu)
uv tool install --force mempalace==3.3.0
rm -rf ~/.mempalace/palace && cp -a ~/palace.bak-$TS ~/.mempalace/palace
```

## 5. Verification checklist (sau khi cài, khi được phép)
1. `gitnexus --version` → 1.6.10; `node --version` trong session cài → v24.13.0.
2. Sau `analyze --index-only`: `git status` chỉ thêm `.gitnexus/`; **0** tracked-file diff; `~/.claude/settings.json` không đổi (không hooks); không có `.claude/skills/gitnexus-*`, không có block gitnexus trong AGENTS.md/CLAUDE.md.
3. Pi restart → `mcp-cache.json` có server `gitnexus` (giống mempalace); hỏi pi "callers của verify_access_token trong backend/src/auth/token.rs" → trả call chain từ `api/auth.rs`.
4. pi-gitnexus: `/gitnexus` menu hiện tại; grep một symbol TS (createHttpLink) thấy enrich callers/callees inline.
5. mempalace: `mempalace status` OK; `search` cũ trả kết quả; dung lượng palace ±; wake-up < 1K tokens.
6. Token/privacy: `SCARF_ANALYTICS=false` đã set khi install (kiểm tra không còn request scarf — tuỳ chọn: chạy với network monitor).

## 6. Risk register
| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| gitnexus license **PolyForm Noncommercial** | 🟠 | Chỉ dùng cá nhân/nội bộ; nếu thương mại → mua Akon Labs hoặc thay bằng Graphify/Orbit |
| Node engines chặn v23.8.0 mặc định | 🟠 | Absolute path node-24 trong .mcp.json; pin nvm alias default 24 nếu tiện |
| Scarf install telemetry | 🟡 | `SCARF_ANALYTICS=false` lúc install |
| `analyze` mặc định mutate AGENTS/CLAUDE/skills/hooks | 🔴 nếu quên flag → 🟢 với plan | **Luôn `--index-only`** (hoặc `.gitnexusrc` `{"indexOnly":true}`); pre-flight trên clone scratch |
| onnxruntime postinstall tải binary ngoài registry | 🟡 | optional dep — fail được dung thứ; hoặc `ONNXRUNTIME_NODE_INSTALL=skip` |
| mempalace sqlite migration one-way | 🟠 | Backup palace bắt buộc (Bước 0); rollback = restore + downgrade 3.3.0 |
| `.pi/` untracked (hiện status repo đang bẩn sẵn ~1957 D) | 🟡 | Commit `.pi/settings.json`; ignore `.pi/npm/` |
| pi-gitnexus exec gitnexus qua PATH | 🟢 | spawn absolute-safe vì gitnexus nằm trong node24 bin; đảm bảo PATH session có node24 khi dùng extension |

## 7. Evidence index
- Local: `.pi/settings.json`, `.pi/npm/node_modules/pi-mcp-adapter/dist/config.js:17`, `~/.pi/agent/mcp-cache.json` (mempalace 29 tools), `~/.nvm/versions/node/`, `~/.mempalace/palace/`, `uv tool list` (mempalace 3.3.0).
- Tarball audit: `/tmp/audit/gx/package/` (gitnexus 1.6.10 — package.json, scripts/build-tree-sitter-grammars.cjs, dist greps), `/tmp/audit/pg/package/` (pi-gitnexus 0.6.4 — package.json, dist/gitnexus.js).
- Registry: registry.npmjs.org/{gitnexus,pi-gitnexus,pi-mcp-adapter}; pypi.org/pypi/mempalace/json.
- Docs: GitNexus README (mutation flags L60/L221/L444-446/L500-517, CLI reference, uninstall); pi docs/packages.md (`-l` project scope, `-e` try-out, `pi remove`); mempalace CHANGELOG.md (#2313 #2283 #2320 #2314 #2308 #2205).
- Báo cáo trước (đã hiệu đính): /tmp/projectmanager-memory-research.md

*Read-only audit — không cài đặt, không sửa file repo/workdir; mọi phân tích tarball nằm trong /tmp/.*
