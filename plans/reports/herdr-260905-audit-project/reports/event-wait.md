# Event-Driven Waiting vs Polling in Herdr — Verification & Skill Update

Run: herdr-260905-audit-project (manager pane; read-only CLI inspection; build worker `pm-build-905` untouched)

## 1. Core verdict (primary source)

**`agent wait` / `agent prompt --wait` are event-driven, not model-side polling.**

- Socket API docs (v0.8.2, herdr.dev/llms.txt → socket-api.mdx, line ~114): *"`agent.wait` is server-owned and event-driven. It pins the resolved pane occupant so a replacement cannot satisfy the wait. `agent.prompt` accepts an optional `wait` object … submits the prompt and starts the wait in one request, avoiding a race between separate calls."*
- Same page method table: Events → `events.subscribe`, `events.wait` (socket API, for persistent clients). No CLI listen/watch command exists (`herdr api` has only `snapshot`/`schema`).
- Binary schema (live `herdr api schema --json`): request methods include `agent.wait`, `agent.prompt`, `events.subscribe`, `events.wait`; `EventsSubscribeParams{subscriptions}` with `Subscription::PaneAgentStatusChanged/PaneOutputMatched/PaneScrollChanged`; `EventData::PaneAgentStatusChanged`; `AgentWaitParams{until,timeout_ms,target}`; `AgentInfo` carries `state`,`seq` (→ `state_change_seq`).
- Contrast: `pane wait-output` **polls** the terminal snapshot (agent-automation.mdx ~line 80) — text already present can match; bounded use only.
- **Host push: NO.** Tools cannot spontaneously push completion to the manager (Codex/pi consume results only when a tool call returns). Completion reaches the manager solely via the blocking wait returning. `events.subscribe` serves long-lived socket clients, not one-shot CLI calls. Skill forbids inventing callbacks.

## 2. Settled states, races, semantics (agent-automation.mdx + live help)

- States: `idle, working, blocked, done, unknown`; default match set idle/done/blocked; `--until` repeatable; `--until unknown` explicit.
- Races/edges: already-`blocked` → prompt rejected `agent_blocked` (no input sent); accepted prompt from non-working state must show a lifecycle change within 5000ms else `agent_prompt_stalled`; **no turn tracking** — prompting an already-working agent can satisfy the wait on the PREVIOUS turn's completion (skill mitigates: one outstanding prompt per task; verify via report gate, not settle alone).
- `idle` = ready for input (seen tab); `done` = idle after background work until tab focused (CLI reads do not mark seen); `unknown` ≠ success. `idle` ≠ completion — review gate still required.
- `agent move`-style pane move mid-wait → wait ends `agent_not_running` (agent-automation.mdx line ~32).
- No default timeout — indefinite; CLI timeout prints compact JSON error, exit 1.

## 3. Live-tested commands (read-only, this session)

| Command | Result |
|---|---|
| `herdr agent prompt --help`, `herdr agent wait --help`, `herdr api --help`, `herdr notification --help` | semantics captured above |
| `herdr api schema --json` (filtered) | `agent.wait` @oneOf/41, `agent.prompt` @40, `events.subscribe` @75, `events.wait` @76 |
| `herdr --session default agent list` | 3 live agents; `state_change_seq` present (7/19/18); pm-skill-905 working, pm-build-905 idle; explicit `agent_session` paths (resume refs) |
| `herdr --session default agent wait pm-build-905 --until idle --timeout 3000` | immediate match, exit 0, compact JSON incl. `agent_session` path |
| `herdr --session default agent wait pm-skill-905 --until idle --timeout 1000` | `{"error":{"code":"timeout","message":"timed out waiting for agent status"}}` — bounded, tiny output |

No helper script written — CLI primitives sufficient (skill keeps `scripts/` empty; nothing to mock-test).

## 4. Community research (honest access limits)

- Reddit search API: HTTP 403 unauthenticated (curl, this session) — no posts retrievable; URL attempted: `https://www.reddit.com/search.json?q=herdr%20agent%20wait`.
- X live search: HTTP 200 but JS-gated; unauthenticated curl returns no extractable posts (`https://x.com/search?q=herdr%20agent.wait&f=live`).
- **No community consensus claimed or fabricated.** All technical claims above are corroborated by primary docs (herdr.dev/llms.txt → agent-automation.mdx, socket-api.mdx, pinned v0.8.2), local CLI help, and live schema/binary. Current loop was already wait-based (not model polling), so no Reddit/X-dependent change was needed.

## 5. Skill changes — `.agents/skills/pm-herdr-orchestration/SKILL.md`

Section 4 new "Waiting discipline (event-driven, low-token)":
- one outstanding wait per task; no sampling reads during blocking wait; `prompt --wait` = single-request submit+wait (race-free); `pane wait-output` polling = bounded only.
- `--timeout` = host wait-call bound, NOT task deadline: absolute deadline stays in ledger; re-arm wait at most once with remaining budget; host yield bound ≤60000ms between manager steps.
- post-settle: report file first; `agent read` only for blocked/missing-report/deadline capture; dedup via `state_change_seq` (repeated seq = no new event, no re-review); low-token ≠ zero-token (no such claim).
- no host push exists; `events.subscribe`/`events.wait` are socket-API-only — no invented callbacks/listener commands.
Section 6 fix: pure provider-quota exhaustion explicitly excluded from `failed:blocked` (routes to `paused:quota`, Section 4).
Unchanged: GLM-only policy, manager pane protection, default session, explicit session resume, security/report/cleanup invariants.

## 6. Validation

- `quick_validate.py` on skill dir → "Skill is valid!" (re-run after edits).
- Both wait paths exercised live (immediate-match, timeout) with compact outputs; no pane input sent; build worker untouched.

## URLs

- https://herdr.dev/llms.txt (index, pinned v0.8.2)
- https://raw.githubusercontent.com/herdrdev/herdr/v0.8.2/docs/next/website/src/content/docs/agent-automation.mdx
- https://raw.githubusercontent.com/herdrdev/herdr/v0.8.2/docs/next/website/src/content/docs/socket-api.mdx

## r2 corrections (skill only; scope/report unchanged)

- Herdr `--timeout` = server-side wait deadline set to REMAINING task budget (not host yield_time_ms); host-yield paragraph replaced.
- Host `exec` early `session_id`: continue the SAME host process (host wait / `write_stdin`); never new Herdr wait / re-prompt on host yield.
- Re-arm policy: Herdr-timeout-with-budget-remaining → read-only re-arms bounded by deadline (not "at most once"); whole-task extension still once (§4 timeout path).
- Push wording narrowed: no verified automatic Codex turn wakeup in current Herdr CLI/tool integration; pending wait returns result on settle; socket subscribers need explicit bridge. Global "tools cannot push" claim removed.
- Primary URLs inlined at the skill section head (herdr.dev/llms.txt → agent-automation.mdx, socket-api.mdx, pinned v0.8.2).
- Manager-quota rule added: on own quota hit → checkpoint immediately, no retries/re-arms. quick_validate re-run: "Skill is valid!".
