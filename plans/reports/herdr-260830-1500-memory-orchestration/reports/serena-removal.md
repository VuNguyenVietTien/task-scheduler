# Serena MCP Removal Report

- **Date:** 2026-08-30
- **Task:** Remove Serena MCP (redundant with GitNexus)
- **Operator:** pi agent (autonomous run, user-approved plan)
- **Result:** ✅ Complete — all 6 steps done, all verifications pass
- **Secrets in this doc:** NONE (credential values intentionally omitted; names only)

## 1. Approved comparison (why Serena goes)

Decision: Serena redundant with GitNexus for this repo's memory stack.

| Aspect | Serena | GitNexus (kept) |
|---|---|---|
| Role | MCP code-navigation (symbols/references, semantic edits) | Code-graph L2: callers/callees, impact, flows |
| Index | Own LSP/language-server caches per project | Single index `.gitnexus/` (18k nodes), pinned `gitnexus@1.6.10` on Node v24.13.0 |
| Cost | 101MB `~/.serena` + 130MB uv venv ≈ 231MB; LSP cold-start latency | Already indexed; one query ≈ tens–hundreds tokens |
| Policy fit | Not part of pm-project-memory 3-layer policy (L1 docs / L2 GitNexus / L3 MemPalace) | L2 layer per `.agents/skills/pm-project-memory/SKILL.md` |
| Overlap | Same answers GitNexus gives via graph queries → duplicate context injection, dual maintenance | Single source of truth for code structure |

Net: keeping both = 231MB + startup overhead + redundant tool results for zero unique capability. Removal approved.

## 2. Steps performed

| # | Step | Evidence |
|---|---|---|
| 1 | Backup outside repo → `~/backups-pm-memory/serena-20260830-225106/` | `memories/` + `serena_config.yml` copied with `cp -a`; SHA-256 recorded in `CHECKSUMS.sha256` (contents never displayed) |
| 2 | Backup `~/.claude.json` → `~/backups-pm-memory/claude.json.bak-20260830-225106`; remove only `mcpServers.serena` via node | String-aware surgical edit (brace-matching, depth-checked against top-level `mcpServers`, not the 13 empty per-project ones). Post-edit: JSON valid; deep-equal check vs original minus serena passed; diff = 1 contiguous hunk @ L1696 (9→1 lines); delta −212 bytes |
| 3 | `uv tool uninstall serena-agent` | Removed executables: `serena`, `serena-agent`, `serena-hooks` |
| 4 | `rm -rf ~/.serena` (only after checksum-verified backup) | Original hashes matched backup hashes pre-deletion |
| 5 | Verification suite | See §3 |
| 6 | This report | — |

Note on step 2: only entry removed was `{type: stdio, command: /Users/TienVNV/.local/bin/serena, args: [...]}` — no env secrets in the entry itself.

## 3. Verification results

| Check | Result |
|---|---|
| `uv tool list` | No serena; remaining: claude-monitor, mempalace, nano-pdf, specify-cli ✅ |
| `~/.claude.json` valid JSON | ✅ |
| `mcpServers` keys | 12 remaining (was 13): byterover-mcp, github, browsermcp, chrome-mcp, fetch, filesystem, mobile, context7-mcp, godot, pencil, lightpanda, gunny-trajectory — serena absent ✅ |
| Non-serena data unchanged | Deep-equality (JSON.stringify) vs original-minus-serena ✅ |
| Space freed | ~231MB total: `~/.serena` 101MB + uv tool venv 130MB; both paths confirmed gone ✅ |
| GitNexus functional | `~/.nvm/versions/node/v24.13.0/bin/gitnexus status` (cwd = repo) returned repo/branch/index metadata OK. Advisory: index flagged "stale" due to pre-existing uncommitted working-tree changes (indexed commit = current commit `4057a01`); unrelated to this removal — re-run `gitnexus analyze --index-only` when convenient ✅ |
| Repo `git status` | Byte-identical to pre-task baseline (1967 entries, pre-existing deletions untouched) ✅ |
| Commit/push | None performed ✅ |

## 4. Backups (private, outside repo — contain plaintext secrets, do NOT copy into repo)

- `~/backups-pm-memory/serena-20260830-225106/memories/` (incl. `global/supabase-config.md`)
- `~/backups-pm-memory/serena-20260830-225106/serena_config.yml`
- `~/backups-pm-memory/serena-20260830-225106/CHECKSUMS.sha256`
- `~/backups-pm-memory/claude.json.bak-20260830-225106`

## 5. 🔐 Security flag — credentials MUST be rotated

`~/.serena/memories/global/supabase-config.md` stored plaintext credentials (now also in the private backup above). Rotating them invalidates the leaked copies:

1. **learning-english project — Supabase postgres DB password** (value omitted here; see backup file).
2. **family password** (value omitted here; see backup file).

Post-rotation: `shred`/delete `~/backups-pm-memory/serena-20260830-225106/` or keep encrypted. Until rotated, treat both credentials as compromised (plaintext at rest, readable by any local process/user).

## 6. Rollback (if ever needed)

```bash
TS=20260830-225106
uv tool install serena-agent
cp -a ~/backups-pm-memory/serena-$TS/memories ~/.serena/memories
cp -a ~/backups-pm-memory/serena-$TS/serena_config.yml ~/.serena/
cp -a ~/backups-pm-memory/claude.json.bak-$TS ~/.claude.json
```

## Unresolved questions

- None blocking. Action pending on user: rotate the 2 credentials in §5.
