# ProjectManager — Nghiên cứu Memory/Knowledge stack cho coding agents
**Ngày:** 2026-08-30 · **Vai trò:** researcher read-only · **Repo:** `/Users/TienVNV/Desktop/ProjectManager`
**Phạm vi:** đánh giá 8 lựa chọn theo 8 tiêu chí; không sửa file repo, không cài gì. Báo cáo lưu ở `/tmp/`.

---

## 0. TL;DR — Khuyến nghị

| Layer | Chọn | Lý do một dòng |
|---|---|---|
| L1 — Context tĩnh | **Giữ nguyên local markdown/ADR** (AGENTS.md, CLAUDE.md, docs/, rule/) | Zero-dep, pi-native (pi tự nạp AGENTS.md/CLAUDE.md), git-versioned, token rẻ |
| L2 — Code graph (TS+Rust) | **GitNexus + pi-gitnexus extension** | Duy nhất có hỗ trợ TS **và** Rust đầy đủ + extension chính thức cho pi + watch incremental + local-first |
| L3 — Long-term memory | **Giữ mempalace, upgrade 3.3.0 → 3.8.0** | Đã cấu hình sẵn (rooms + palace + .mcp.json), local-first, không API key, wake-up ~600–900 tokens |

**Không nên cài:** gkg (maintenance mode), GitLab Orbit Local (beta, MCP chưa xong, Rust chưa xác nhận), Mem0 (trùng chức năng mempalace, tốn token LLM mỗi lần add, cloud-first), Obsidian MCP (cần app Obsidian chạy, không phải code graph). **Defer:** Graphify (trùng GitNexus cho code; chỉ đáng cân nhắc khi cần graph cho docs/papers + viz HTML).

**⚠️ Điều kiện tiên quyết cho GitNexus:** license **PolyForm Noncommercial 1.0.0** — OK cho ProjectManager cá nhân/nội bộ, **không OK cho sản phẩm thương mại** (lúc đó phải mua Akon Labs enterprise hoặc đổi sang Orbit/Graphify).

---

## 1. Bối cảnh local (evidence từ repo & máy)

- `.mcp.json` (root) đang wire 2 MCP server cho client kiểu Claude Code/OpenCode: `mempalace` (stdio, `uv tools` python 3.13, palace `~/.mempalace/palace`) + `supabase` (HTTP). → mempalace là memory đang cấu hình.
- `mempalace.yaml` (root): 15 rooms map theo folder (tasks, frontend, web, backend, docs, rule, plans, …) — cấu hình project-scope đã tồn tại.
- `~/.mempalace/palace/` có sẵn index thực: `chroma.sqlite3` + `knowledge_graph.sqlite3` + HNSW binary (`data_level0.bin`, `link_lists.bin`) → đã mine ít nhất một lần.
- `uv tool list` → **mempalace v3.3.0** (PyPI mới nhất **v3.8.0**), kèm serena-agent v1.6.1 (đã có sẵn, không nằm trong scope 8 lựa chọn).
- Skills AgentKit đã cài (phía Claude): `ak-gkg`, `ak-graphify` (SKILL.md đọc được tại `~/.claude/skills/`) — tức 2 tool này mới chỉ ở mức "skill mô tả", **chưa cài binary**.
- Repo có sẵn lớp markdown: `AGENTS.md`, `CLAUDE.md`, `docs/` (7 file: architecture, code-standards, changelog, roadmap…), `rule/` (spec nghiệp vụ), `plans/` → L1 đã tồn tại, chỉ thiếu quy ước ADR.
- **Pi không có MCP native** — README pi (phiên bản đang chạy, v23.8.0 node package `@earendil-works/pi-coding-agent`): *"**No MCP.** Build CLI tools with READMEs (see Skills), or build an extension that adds MCP support."* + link https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/. Extensions có thể thêm MCP (`docs/extensions.md` liệt kê "MCP server integration" là khả năng của extension). → Mọi đánh giá "Pi compatibility" dưới đây = đường pi-native (extension/CLI/skill), không phải MCP.

---

## 2. Ma trận đánh giá

Tiêu chí: (1) Code graph TS+Rust · (2) Long-term project memory · (3) Privacy/local-first · (4) Freshness/incremental · (5) Pi compatibility · (6) Maintenance/security · (7) Token cost · (8) License/rủi ro pháp lý

| Tool | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Kết luận |
|---|---|---|---|---|---|---|---|---|---|
| **GitNexus** | 🟢 TS+Rust full | 🔴 không (code only) | 🟢 local (LadyugDB+tree-sitter native) | 🟢 `analyze --watch` incremental | 🟢 **pi-gitnexus** ext chính thức | 🟢 CI, OpenSSF scorecard, SECURITY.md | 🟢 trả lời compact + enrich inline nhỏ | 🟡 PolyForm Noncommercial | **CHỌN (L2)** |
| **mempalace** (đang dùng) | 🔴 không phân tích symbol | 🟢 verbatim, wings/rooms/drawers | 🟢 100% local, no API key | 🟡 batch `mine` (pi không có hooks auto) | 🟡 MCP cho Claude/OpenCode; pi dùng CLI/skill | 🟢 MIT, ⭐58.7k, push 2026-08-28 | 🟢 wake-up ~600–900 tok; compress ~30× | 🟢 MIT | **GIỮ + UPGRADE (L3)** |
| **Local markdown/ADR** | 🔴 không query symbol | 🟢 nếu có kỷ luật viết | 🟢 tối đa | 🔴 thủ công, dễ stale | 🟢 pi-native | 🟢 git | 🟢 rẻ nhất (nếu curated) | 🟢 | **GIỮ (L1)** |
| **Graphify** | 🟢 tree-sitter 20 ngôn (có Rust+TS) | 🟡 graph docs/papers | 🟡 code local; docs/images qua LLM API | 🟢 cache SHA256 + `--watch` | 🟡 MCP serve (4 tools) — không pi-native | 🟢 Apache-2.0, ⭐112.5k (GitHub API) | 🟢 claim 71.5× ít token hơn raw files | 🟢 Apache-2.0 | **DEFER** — trùng GitNexus phần code |
| **Mem0** | 🔴 không | 🟢 mạnh (multi-level, temporal) | 🟡 OSS self-host được nhưng extraction = LLM call | 🟢 realtime add/search | 🔴 MCP-first, không pi path | 🟢 VC-backed, rất active | 🟡 ~7K tok/benchmark cycle + LLM mỗi `add` | 🟡 OSS + platform | **KHÔNG** — trùng mempalace |
| **Obsidian MCP** | 🔴 không | 🟢 vault notes | 🟢 localhost REST | 🟢 live vault | 🔴 MCP-only (cần extension bridge tự viết) | 🟡 pin `mcp<2.0`, cần Obsidian app chạy | 🟡 trả về nguyên file note | 🟢 MIT | **KHÔNG** — repo không dùng vault |
| **gkg** (GitLab KG) | 🔴 TS/JS/Python "in progress", **không Rust** | 🔴 | 🟢 local (KuzuDB, `~/.gkg/`) | 🔴 stop server → re-index tay | 🟡 MCP 7 tools + HTTP :27495 | 🔴 **MAINTENANCE MODE** | 🟢 | — | **KHÔNG CÀI** |
| **GitLab Orbit Local** | 🟡 11+ ngôn (matrix chưa verify; **Rust chưa xác nhận**) | 🔴 | 🟢 DuckDB `~/.orbit/graph.duckdb`, offline | 🟡 re-run index | 🟡 MCP "(planned)" theo README repo | 🟡 **Beta** (GitLab 19.1) | 🟢 | 🟡 repo badge GitLab EE | **THEO DÕI** — re-eval sau beta |

---

## 3. Phân tích từng lựa chọn (evidence + link)

### 3.1 GitNexus — https://github.com/abhigyanpatwari/GitNexus
- ⭐46,468 · cập nhật 2026-08-30 · npm `gitnexus` · license **PolyForm Noncommercial 1.0.0** · OpenSSF Scorecard + CI badge + SECURITY.md.
- **Ngôn ngữ (README bảng "Supported Languages"):** TypeScript ✓ toàn bộ 9 cột (Imports, Named Bindings, Exports, Heritage, Type Annotations, Constructor Inference, Config, Frameworks, Entry Points); **Rust ✓ 8/9** (thiếu Config). CFG/PDG opt-in `--pdg` hiện chỉ TS/JS (#2081 M1).
- **Kiến trúc:** tree-sitter native + LadyugDB native, "Everything local, no network" (CLI+MCP mode). Embeddings optional (ONNX local runtime tại `~/.gitnexus/embedding-runtime`).
- **Freshness:** `gitnexus analyze` update index stale; `analyze --watch` = debounce 300ms, incremental refresh serialized, MCP tự nhận index mới trong ~5s; workspace index theo branch.
- **Pi:** extension **tintinweb/py-gitnexus** (`pi install npm:pi-gitnexus`) — enrich tự động mọi `read/grep/find/bash/read_many` bằng callers/callees/imports + 7 tools đăng ký thẳng vào pi. Tác giả tintinweb (security researcher nổi tiếng), ⭐199, update 2026-08-29.
- **MCP cho client khác:** `gitnexus mcp` (stdio); `gitnexus setup` auto-detect Claude Code, Cursor, Codex, Windsurf, **OpenCode**…; snippet thủ công trong README:
  ```json
  { "mcpServers": { "gitnexus": { "command": "npx", "args": ["-y", "gitnexus@latest", "mcp"] } } }
  ```
- **Rủi ro:** (a) license noncommercial; (b) `analyze` **viết vào repo**: tạo/sửa `AGENTS.md`/`CLAUDE.md`, cài agent skills, đăng ký hooks → bắt buộc review `git diff` trước commit; (c) surface supply-chain lớn (native deps, postinstall onnxruntime tải từ nuget — có flag skip); (d) README phải đính chính "no crypto token" → dấu hiệu hype/xáo trộn, nhưng bản thân tool có CI + scorecard.
- Gỡ sạch: `gitnexus uninstall --force` (preview trước).

### 3.2 mempalace (đang cấu hình) — https://github.com/MemPalace/mempalace · https://pypi.org/project/mempalace/
- Đang chạy **v3.3.0**, upstream **v3.8.0** (2026-08-28 push) · MIT · ⭐58,742.
- Mô hình: wings (people/projects) → rooms (topics/folders) → drawers (verbatim text). **Không summarize**, lưu nguyên văn; backend mặc định ChromaDB (pluggable qua `mempalace/backends/base.py`).
- Benchmark tự công bố: 96.6% Recall@5 LongMemEval **không API key/cloud/LLM**; hybrid v4 98.4% held-out. Docker image `ghcr.io/mempalace/mempalace` cho MCP/CLI.
- Token: `wake-up` (L0+L1 context) ~600–900 tokens; `compress` ~30× bằng AAAK Dialect.
- Đã có trong repo: `.mcp.json` (stdio MCP), `mempalace.yaml` (15 rooms), palace index tại `~/.mempalace/palace`.
- Điểm yếu: freshness theo đợt `mine` (Claude Code có hooks auto-save; **pi không có hooks** → chạy `mempalace mine` thủ công/cuối session); cảnh báo impostor sites trên README (chỉ tin GitHub/PyPy/mempalaceofficial.com).

### 3.3 Local markdown / ADR (đã có trong repo)
- Evidence: `AGENTS.md` + `CLAUDE.md` root; `docs/{system-architecture,code-standards,codebase-summary,project-overview-pdr,development-roadmap,project-changelog}.md`; `rule/` (spec nghiệp vụ: apis, business_requirement, database design, screens…); `plans/`.
- Ưu: pi tự nạp AGENTS.md/CLAUDE.md làm context; zero dependency; review được bằng git; rẻ token nếu giữ ngắn.
- Nhược: stale nếu không kỷ luật; không trả lời được "ai gọi hàm này" — đó là việc của L2.
- Đề xuất nhỏ (không bắt buộc): thêm `docs/adr/0001-...md` cho quyết định kiến trúc (enum casing, migration tree, deployment) — phục vụ trực tiếp các issue đang mở của repo này.

### 3.4 Graphify — https://github.com/safishamsi/graphify · PyPI `graphifyy` (double-y)
- Apache-2.0 · ⭐112,518 (GitHub API, 2026-08-30) · Python.
- 3 pass: (1) AST tree-sitter **local** — 20 ngôn ngữ gồm **TypeScript + Rust**; (2) Whisper local cho media; (3) LLM subagents cho docs/papers/images (**data rời máy** nếu dùng API).
- Output: `graphify-out/graph.html` (viz), `GRAPH_REPORT.md` (god nodes), `graph.json`; cache SHA256 incremental; `--watch`; MCP serve `python -m graphify.serve` với 4 tools (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`) — cấu hình cho Claude, **không có path pi-native**.
- Claim token: "71.5× fewer tokens vs raw files".
- Vì sao defer: chức năng code-graph trùng GitNexus (mà GitNexus có resolution chi tiết hơn + pi ext); giá trị riêng = graph cho **tài liệu/spec** (`rule/`, `docs/` lớn) + visualization HTML. Nếu sau này cần, cài `pip install graphifyy` (KHÔNG phải `graphify install`) và dùng CLI report, bỏ MCP.

### 3.5 Mem0 — https://github.com/mem0ai/mem0 · https://docs.mem0.ai
- 3 hình thức: Library (`pip install mem0ai`), Self-hosted server (`docker compose up`), Cloud Platform (app.mem0.ai). Algorithm 2026-04: single-pass ADD-only extraction, entity linking, BM25+semantic+entity fusion, temporal reasoning; LoCoMo 92.5 / LongMemEval 94.4 — nhưng **"Scores reflect Mem0's managed platform… open-source users should expect directionally similar gains but not identical numbers"**.
- Vì sao không chọn: (a) memory extraction phụ thuộc LLM → chi phí token mỗi `add` (benchmark ~7K tokens/cycle) trong khi mempalace đạt 96.6% recall không LLM nào; (b) trùng vai trò long-term memory với mempalace đã wired; (c) hướng platform/cloud, không local-first mặc định; (d) pi không có đường dùng trực tiếp.

### 3.6 Obsidian MCP — https://github.com/MarkusPfundstein/mcp-obsidian
- ⭐4,356. Yêu cầu: **app Obsidian đang chạy + plugin "Local REST API"** (coddingtonbear/obsidian-local-rest-api, ⭐2,867) tại `127.0.0.1:27124` với API key. Tools: list/get/search/patch/append/delete trên vault.
- Pin `mcp>=1.1.0,<2.0.0` — SDK 1.x low-level API đã bị xóa ở mcp 2.0 → dấu hiệu bảo trì chậm.
- Vì sao không: repo không dùng vault Obsidian (markdown thẳng trong git tốt hơn cho CI/diff); cần daemon Obsidian luôn chạy; MCP-only nên pi không dùng được trừ khi tự viết extension bridge; không cung cấp code graph. Chỉ cân nhắc lại nếu bạn đã có vault Obsidian cá nhân làm KB thứ hai.

### 3.7 gkg (GitLab Knowledge Graph) — https://gitlab.com/gitlab-org/rust/knowledge-graph
- README chính chủ: **"Maintenance Mode: no longer under active development… successor is gitlab-org/orbit/knowledge-graph (GitLab Orbit)"**.
- Ngôn ngữ (theo skill ak:gkg kèm theo cài đặt): Ruby/Java/Kotlin full; **Python/TypeScript/JavaScript "in progress"**; **không có Rust**. KuzuDB local `~/.gkg/`; phải stop server trước khi re-index; cross-repo chưa nối.
- Kết luận: loại bỏ — thay bằng successor nếu/ khi ổn định.

### 3.8 GitLab Orbit Local — https://docs.gitlab.com/orbit/local/ · https://gitlab.com/gitlab-org/orbit/knowledge-graph
- **Beta** (introduced 19.0 experiment → beta 19.1). Single-binary CLI, DuckDB `~/.orbit/graph.duckdb`, offline, không tốn GitLab credits; index "same 11+ languages as Orbit Remote" (matrix chi tiết nằm ở trang docs bị Cloudflare chặn curl — **Rust support chưa verify được**).
- README repo ghi MCP access **"(planned)"** (trang docs liệt kê MCP như access method — mâu thuẫn, lấy README làm trạng thái hiện tại). License repo: badge "GitLab EE" (có community fork).
- Kết luận: theo dõi; re-evaluate khi ra GA + xác nhận Rust + MCP ổn định. Là ứng viên thay thế GitNexus nếu license noncommercial trở thành vấn đề.

---

## 4. Pi MCP compatibility — chi tiết
1. Pi **không load `.mcp.json`** cũng không có MCP client built-in (README: "No MCP"). `.mcp.json` ở root repo chỉ phục vụ Claude Code/OpenCode.
2. Đường pi-native cho từng tool:
   - GitNexus: 🟢 `pi install npm:pi-gitnexus` (được maintain riêng, enrich mọi read/grep/find).
   - mempalace: 🟢 dùng như CLI (`mempalace wake-up` / `search` / `mine`) gọi qua skill hoặc bash — không cần MCP. Có thể viết extension wrapper sau này nếu muốn tự động hóa.
   - gkg/Orbit: 🟡 có HTTP/CLI nhưng gkg chết, Orbit chưa sẵn.
   - Graphify serve / Obsidian / Mem0-MCP: 🔴 MCP-only → phải tự viết extension bridge (khó khuyến khích).
3. Nguyên tắc pi: "CLI tools with READMEs (Skills)" — Ưu tiên tool có CLI tốt + skill mô tả; đó cũng là lý do ma trận trên trọng CLI hơn MCP.

---

## 5. Install/config plan project-scope (CHƯA chạy — chỉ kế hoạch)

```bash
# ---------- L2: GitNexus ----------
# 1. Cài global (npm >= node 22.15 khuyến nghị; không cần C++ toolchain)
npm install -g gitnexus            # hoặc: GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1 npm i -g gitnexus
gitnexus --version                 # verify

# 2. Index repo (chạy từ repo root)
cd ~/Desktop/ProjectManager
gitnexus analyze                   # ⚠️ SẼ tạo/sửa AGENTS.md/CLAUDE.md + skills/hooks
git status && git diff             # BẮT BUỘC review diff trước khi commit (cherry-pick context block)
gitnexus status                    # kiểm tra index

# 3. Extension cho pi
pi install npm:pi-gitnexus         # yêu cầu gitnexus >= 1.4.8 trên PATH
# trong phiên pi tiếp theo: /gitnexus analyze  (nếu chưa index)

# 4. (Optional) MCP cho Claude Code / OpenCode đang dùng repo này
gitnexus setup -c claude,opencode  # viết MCP config global; hoặc thêm thủ công vào .mcp.json:
#   { "mcpServers": { "gitnexus": { "command": "gitnexus", "args": ["mcp"] } } }

# 5. Watch mode khi làm việc dài (terminal riêng)
gitnexus analyze --watch           # incremental, debounce 300ms

# ---------- L3: mempalace upgrade ----------
uv tool upgrade mempalace          # 3.3.0 → 3.8.0 (fix migrate/repair cho Chroma 3.x)
mempalace status                   # xem đã file gì
mempalace mine .                   # refresh index theo rooms trong mempalace.yaml
mempalace wake-up                  # ~600–900 tokens — chạy đầu session (hoặc gọi qua skill)

# ---------- L1: markdown/ADR ----------
# Không cài gì. Chỉ đề xuất: docs/adr/NNNN-slug.md cho các quyết định lớn
# (enum casing, single migration tree, deployment topology) — viết tay, review bằng PR.

# ---------- Guard ----------
# Sau gitnexus analyze: kiểm tra artifacts trong repo; thêm vào .gitignore nếu có
# (.gitnexusrc, graph outputs…). Index thật nằm ngoài repo (LadybugDB native).
```

**Rollback / gỡ sạch:**
```bash
gitnexus uninstall --force         # preview trước khi --force; gỡ MCP/skills/hooks
pi uninstall npm:pi-gitnexus       # gỡ extension pi (hoặc theo docs pi packages)
uv tool uninstall mempalace        # chỉ khi bỏ hẳn L3 (không khuyến nghị — đang dùng tốt)
```

**Verification checklist sau khi cài (khi được phép):**
1. `gitnexus query` / `/gitnexus` trong pi: hỏi "callers của `verify_access_token`" (backend/src/auth/token.rs) → phải trả call chain từ `api/auth.rs` handlers.
2. Hỏi symbol TS: "ai import `createHttpLink`" (web/src/apollo/client.ts) → phải liệt kê files.
3. `gitnexus status` sau 1 giờ code + `analyze` lại → thời gian incremental phải < full run đầu.
4. `mempalace search "enum mismatch uppercase"` → phải trả về drawer chứa audit session trước.
5. Token: so sánh `wake-up` (~<1K) vs trước upgrade.

**Token cost ước tính cho stack đề xuất:**
- L1: 0 (AGENTS.md ngắn, đã trong context mặc định).
- L2: enrich inline của pi-gitnexus ~ vài chục–vài trăm tokens/lần read/grep; truy vấn graph theo yêu cầu (compact) — thay thế việc cat nhiều file (thắng ròng).
- L3: `wake-up` ~600–900 tokens/phiên + `search` theo cần.
- Tổng: thấp hơn đáng kể so với repomix/read nhiều file; không có chi phí LLM nền (không embeddings bắt buộc, không Mem0-style extraction).

---

## 6. Risks & unresolved questions
1. **GitNexus license PolyForm Noncommercial** — nếu ProjectManager (hoặc sản phẩm sinh ra từ nó) thương mại hóa → phải mua Akon Labs hoặc thay bằng Orbit Local/Graphify. Quyết định trước khi gắn sâu (hooks/AGENTS.md).
2. `gitnexus analyze` sửa AGENTS.md/CLAUDE.md và cài hooks — cần quy trình review diff; cân nhắc chỉ chạy `gitnexus mcp` + index, bỏ phần setup hooks nếu muốn footprint tối thiểu.
3. Orbit Local: chưa xác nhận được Rust + MCP "(planned)" — cần re-check khi GitLab 19.2+.
4. mempalace + pi: chưa có cơ chế auto-mine cuối session (pi không hooks). Phương án: extension nhỏ gọi `mempalace mine` on-exit, hoặc thói quen thủ công.
5. Graphify: nếu sau này cần graph cho `rule/` + `docs/` (không phải code), cài `graphifyy` CLI-only, chấp nhận LLM pass cho docs (data rời máy) hoặc bỏ pass 3.
6. SereneAgent v1.6.1 đã cài trên máy (LSP symbols + memories) — ngoài scope 8 lựa chọn nhưng có thể là fallback L2 không cần cài thêm; chưa đánh giá chi tiết.

---

## 7. Link index (evidence)
- pi (no-MCP philosophy): https://github.com/mariozechner/pi · local README `@earendil-works/pi-coding-agent` · https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/
- GitNexus: https://github.com/abhigyanpatwari/GitNexus (README: languages, CLI reference, watch, MCP json, uninstall) · license https://polyformproject.org/licenses/noncommercial/1.0.0/
- pi-gitnexus: https://github.com/tintinweb/pi-gitnexus
- mempalace: https://github.com/MemPalace/mempalace · https://pypi.org/project/mempalace/ (v3.8.0, MIT) · docs https://mempalaceofficial.com
- Graphify: https://github.com/safishamsi/graphify · PyPI `graphifyy` (via skill ak:graphify)
- Mem0: https://github.com/mem0ai/mem0 · https://docs.mem0.ai (benchmark + platform caveat trong README)
- Obsidian MCP: https://github.com/MarkusPfundstein/mcp-obsidian · https://github.com/coddingtonbear/obsidian-local-rest-api
- gkg (maintenance mode) → Orbit: https://gitlab.com/gitlab-org/rust/knowledge-graph · https://gitlab.com/gitlab-org/orbit/knowledge-graph · https://docs.gitlab.com/orbit/local/
- Local: `.mcp.json`, `mempalace.yaml`, `~/.mempalace/palace/`, `uv tool list`, `~/.claude/skills/ak-{gkg,graphify}/SKILL.md`, `docs/`, `rule/`, `AGENTS.md`, `CLAUDE.md`

*Báo cáo read-only — không file repo nào bị thay đổi; không cài đặt gì. Ngày lấy evidence: 2026-08-30 (GitHub/GitLab API + raw README qua curl).*
