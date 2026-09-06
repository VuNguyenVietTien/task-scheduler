# /goal Availability, Usage-Limit Checking, and Goal-Driven Continuation — Audit (r2)

Run: herdr-260905-audit-project (manager pane; read-only inspection + skill edit; no commit/push/deploy/credential access)
Status: REWORK applied — all 9 review fixes incorporated.

## 1. Pi `/goal` — verified local snapshot, re-discovered each run

**This run (pi 0.85.0, this machine): no `/goal` anywhere in the pi runtime — native, extension, or package — for ANY provider.** Recorded as a dated snapshot, not a permanent fact; the skill now mandates per-run re-discovery.

Evidence:
- `pi` → `@earendil-works/pi-coding-agent@0.85.0` (`dist/bundle/cli.js`, package.json `bin.pi`).
- Native registry `dist/core/slash-commands.js:3-25`: settings…quit; no `goal`. `grep -ri goal` over `dist/ docs/ examples/`: no command matches.
- Extension sources checked this run: global `~/.pi/agent/extensions/` (herdr-agent-state.ts, pi-graph-workflow, selected-mcp-bridge), skills `~/.pi/agent/skills/`, project `<project>/.pi/` (contains `npm/`, `settings.json`; **no `.pi/extensions/` dir**), global settings.json (no extension-source entries). No goal registration. Credentials/auth/session logs excluded, none read.
- Same absence in normal `pi` and `pi --no-extensions`.
- **Provider distinction (explicit):** ChatGPT as a provider INSIDE pi still has no `/goal` — the command does not exist in this runtime at all, provider-independent. That is separate from **Codex goals** (distinct CLI) below. Skill states both.

## 2. Codex goals — proven only to the level of local evidence

- `codex` at `/Users/TienVNV/.local/bin/codex`; `codex features list` → `goals  stable  true` (live). No `[features]` override in `~/.codex/config.toml` → default-on. No zai/GLM model_provider in config.toml → goals are ChatGPT/OpenAI-side here.
- **Control syntax NOT asserted:** local binary strings and help did NOT prove `pause/resume/clear` (or any) `/goal` subcommand forms this run; the local `ak:codex-goal` skill is documentation, not authoritative verification. Removed from the skill. Skill rule: confirm `/goal` in the live slash list, use only syntax the live runtime proves; otherwise fall back to plain briefs.
- Manager-side `get_usage_limits` observed this session: 66% used (5h window), 26% weekly — recorded in this report as an observed time snapshot; the skill instructs recording observed percentages + timestamp + source per snapshot, and only forbids hardcoding stale values as defaults.

## 3. Usage/quota surfaces (validated)

| Surface | Shows | Account quota? | Checked |
|---|---|---|---|
| Pi footer / `/session` | session tokens, context, cost | No | docs/usage.md |
| Pi `/compact [prompt]` | context relief | No | slash-commands.js:22 |
| `pi auth check --provider zai --no-refresh` | readiness only → `ready`; no refresh, no secret output, no quota values | No | run live this session |
| Codex `get_usage_limits` (manager tool) | account usage snapshot | Yes | observed 66%/26% at snapshot time |

No credential-safe GLM quota endpoint/command exists in pi source → quota recorded `unknown`, never as zero.

## 4. Skill changes (r2) — `.agents/skills/pm-herdr-orchestration/SKILL.md`

1. Pre-flight step 6: per-run re-discovery of goal-command registry across live slash list, global+project+configured-package extension sources (metadata only, never credentials); usage snapshot recorded WITH observed values + timestamp + source.
2. "Goal Mode and Usage Limits": snapshot-phrased pi absence incl. ChatGPT-inside-pi vs Codex-goals distinction; Codex control syntax removed (unproven locally); manager-side usage snapshots recorded, stale hardcoding forbidden.
3. Section 4: timeout explicitly excludes `paused:quota`; quota block: manager writes checkpoint from last known evidence when worker cannot respond (no model turn required to save); bounded single probe after known reset time/Retry-After when no quota endpoint; no automatic scheduled tasks; never `failed:blocked` for quota.
4. Section 7 cleanup: closing an owned quota-paused pane requires capturing explicit session reference (from `agent get` state) + remaining-acceptance list first.
5. Resume: explicit captured session path/id via `pi --session <path|id>`; `--continue`-by-cwd explicitly rejected (may grab another worker's session).
6. Auth command fixed to exact safe form `pi auth check --provider zai --no-refresh`.
7. Unchanged/preserved: GLM-only workers, manager pane protection, default session, report/review/cleanup security, ledger, review gate.

## 5. Validation

- `quick_validate.py` (skill-creator, `~/.codex/skills/.system/skill-creator/scripts/quick_validate.py`) run against the skill dir → **"Skill is valid!"** (run again post-r2 edits: pass).
- `pi auth check --provider zai --no-refresh` → `ready` (live, no credential material).
- `codex features list` → `goals stable true` (live).
- Post-edit re-read: pre-flight numbering intact (7 steps), section cross-references consistent.

## Unresolved

- Codex `/goal` subcommand syntax unverified locally — intentionally not asserted; verify in live slash list before use (encoded in skill).
- GLM quota: no safe endpoint found; unknown-by-design, single bounded probe after known reset permitted by skill.
