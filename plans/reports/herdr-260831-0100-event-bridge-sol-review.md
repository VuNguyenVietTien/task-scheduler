# Sol / High Architecture Review — Herdr→Codex Event Bridge

- **Role:** Sol (high reasoning), architecture reviewer. Read-only investigation.
- **Task:** Event-driven bridge from Pi agents in Herdr panes to the Codex ProjectManager task. No periodic polling; each worker completion/block event durably enqueued; simultaneous events processed sequentially; Codex awakened to review and may dispatch another reviewer.
- **Date:** 2026-08-31 (~07:55 local). **Result:** report only; no source/config/external state modified.
- **Method:** local binaries/help/schema/strings/live-socket probe only. `~/.pi/agent/extensions/herdr-agent-state.ts` was READ, never edited (Herdr-owned, overwritten on update — confirmed by its own header and `herdr integration status`).

---

## 0. Executive verdict

The bridge is feasible today with **zero new Herdr or Pi surface**, because Herdr 0.8.2 already exposes a **persistent push event stream** over its socket API (`events.subscribe` → `pane.agent_status_changed`), validated live during this review. The smallest reliable architecture is **one small local daemon** that:

1. subscribes to agent-status events for pm-owned panes (push, no polling),
2. appends each event to an fsync'd JSONL queue (durable),
3. drains the queue strictly sequentially (single consumer, flock-guarded),
4. wakes Codex per event via `codex exec resume <manager-thread-id> "<digest>" --json -o <last-msg-file>`, letting the awakened Codex review the worker report and (optionally) dispatch another reviewer through the existing `herdr` CLI.

browsermcp is **excluded from the critical path** (single-instance port-kill behavior, no durability, Chrome-extension dependent — §7).

---

## 1. Ground truth (live evidence)

| Item | Value | Evidence |
|---|---|---|
| Herdr | 0.8.2, protocol 20, server running | `herdr status` → socket `/Users/TienVNV/.config/herdr/herdr.sock`, `compatible: yes` |
| Pi (workers + this reviewer) | pi 0.84.4 | `pi --version`; `~/.pi/agent/settings.json` (`defaultModel gpt-5.6-sol`) |
| Codex CLI | codex-cli 0.144.6 | `codex --version` |
| Codex Desktop | ChatGPT.app running; own app-server child (PID 1655, `codex … app-server`) | `pgrep -fl app-server` |
| Live Herdr session | workspace `w3` (number 1, label ProjectManager), panes `w3:p3` (manager pi = this session), workers `pm-event-sol` (w3:pE), `pm-found-a` (w3:pC), `pm-auth-b` (w3:pD), all pi, all `working`, each with `agent_session` = pi session .jsonl path | `herdr api snapshot` |
| Codex manager thread | id `01a05543-0da5-7f52-b489-9a6b0b92ebd3`, rollout `~/.codex/sessions/2026/08/31/rollout-2026-08-31T07-40-52-01a05543-….jsonl` | `~/.codex/session_index.jsonl` |
| Existing bridge/daemon | **none** — no `events.subscribe` usage in repo, no launchd services, no local broker | `grep -r`, `launchctl list`, `pgrep redis\|rabbitmq` |
| No CLI app-server daemon | `~/.codex/app-server-control/app-server-control.sock` absent | `codex app-server daemon version` → connect error |

Live protocol probe (read-only, ephemeral connection, closed after):

```
connect ~/.config/herdr/herdr.sock
→ {"id":"solprobe:b","method":"events.subscribe","params":{"subscriptions":[
     {"type":"pane.agent_status_changed","pane_id":"w3:pE"}, … ]}}\n
← {"id":"solprobe:b","result":{"type":"subscription_started"}}
# connection stays open; per schema, {"event":…,"data":…} envelopes are pushed as JSON lines
```

Findings: `pane.agent_status_changed` subscription **requires `pane_id`** (schema `required:["type","pane_id"]`; server returned `invalid_request: missing field pane_id` when omitted). The server closed the connection after answering a bare `ping` — **request/response + event push is per-connection; subscriptions are connection-scoped** (must re-subscribe after reconnect).

---

## 2. (A) Event capture — what exists

### 2.1 Herdr socket API (protocol 20) — primary capture point ✅ exists

`herdr api schema` (schemas: `request`, `event`, `subscription_event`, `success_response`, `error_response`). Relevant request methods: `events.subscribe`, `events.wait`, `agent.wait`, `agent.get`, `agent.read`, `agent.prompt`, `pane.report_agent`, `pane.report_agent_session`, `plugin.*`.

- `events.subscribe` → `subscriptions: [{type:"pane.agent_status_changed", pane_id, agent_status?}]`; also `pane.agent_detected`, `pane.created`, `pane.exited`, `pane.output_matched` (substring/regex match push!), `pane.scroll_changed`, workspace/tab events.
- Push envelope: `SubscriptionEventEnvelope {event, data}`; `PaneAgentStatusChangedEvent` = `{pane_id, workspace_id, agent_status: idle|working|blocked|done|unknown, agent, display_agent, title, state_labels}`.
- `agent_status` semantics (from `herdr --skill`, authoritative): `idle` = ready for input & tab seen; `done` = idle after unseen background work; `blocked` = approval/question UI recognized; `unknown` ≠ completion.
- One-shot alternative: `events.wait {match_event:{event:"pane_agent_status_changed",pane_id,agent_status}, timeout_ms}` and CLI `herdr agent wait <name> --until idle|done|blocked` (blocking, not polling — but ties up the caller and covers one agent at a time; this is today's manual loop in the pm-herdr-orchestration skill).

### 2.2 Pi extension hooks — secondary/richer capture ✅ exists (for pi agents)

`~/.pi/agent/extensions/herdr-agent-state.ts` (HERDR_INTEGRATION_VERSION=8), read-only analysis:

- Activated only when `HERDR_ENV=1` + `HERDR_SOCKET_PATH` + `HERDR_PANE_ID` (injected by Herdr into every managed pane).
- Sends newline-delimited JSON requests `pane.report_agent` `{pane_id, source:"herdr:pi", agent:"pi", state: working|blocked|idle, message, seq}` and `pane.report_agent_session` `{…, agent_session_path|agent_session_id}` — this is what populates the snapshot's `agent_session` (pi session .jsonl) and drives `agent_status`.
- Gated to TUI mode only (`ctx.mode !== "tui"` → skip); queue-drains concurrent state reports; 500 ms/1500 ms retries.
- Pi events it consumes: `pi.events.on("herdr:blocked")`, `pi.on("session_start"|"agent_start"|"agent_settled")`.

Pi 0.84.4 extension API (official docs, global npm package) offers the full hook set a **companion** extension may use — no need to touch the Herdr file:

- Load locations: `~/.pi/agent/extensions/*.ts` (global) or **`.pi/extensions/*.ts` project-local** (auto-load after project trust — preferred scope: only ProjectManager sessions, i.e. exactly the workers).
- Lifecycle events: `session_start/shutdown`, `before_agent_start`, `agent_start/agent_end/agent_settled` (**`agent_settled` = "Pi will not continue running automatically" — the true completion signal**), `turn_start/turn_end`, `message_start/update/end`, `tool_execution_*`, `ui_prompt_start/ui_prompt_end` (waiting-for-user spans).
- Custom bus: `pi.events.emit("…")` / `pi.events.on("…")` (docs §"pi.events").

### 2.3 Herdr plugin system — alternative native capture ✅ exists (v2 option)

Embedded in the binary + API schema: manifest `herdr-plugin.toml` with `[[events]] {on, command[], platforms?}`; event-hook names are the dotted forms (`pane.agent_status_changed`, `pane.agent_detected`, `workspace.*`, `layout.updated`, …). Plugin commands run with `HERDR_PLUGIN_ID`, `HERDR_PLUGIN_ENTRYPOINT_ID`, `HERDR_PLUGIN_CONTEXT_JSON` (context: workspace/tab/pane ids, cwd, focused pane agent/status…). CLI: `herdr plugin install <owner>/<repo>[/subdir]`, `herdr plugin link <path>`, `herdr plugin list`. Unknown event names → non-fatal warning surfaced by `plugin.list`.

### 2.4 Gaps in (A)

1. **Pi "blocked" is weakly wired.** `pi.events.on("herdr:blocked")` has **no local emitter** — grep of pi 0.84.4 package, all `~/.pi` extensions, and Herdr binary found none (only the listener exists). Unless something emits it at runtime, pi workers never report `blocked` through the integration; blocked then surfaces only via Herdr's screen detection (`AgentManifest` rules: `visible_blocker` regions), which is currently skipped for these panes (`screen_detection_skipped: true` in snapshot, integration-reported sessions take over). **Mitigation (companion extension, no Herdr-file edit): map `ui_prompt_start/ui_prompt_end` → enqueue `blocked`/`unblocked` events directly to the queue** (and/or emit `herdr:blocked`-equivalent data into the queue).
2. Subscription requires per-pane registration → daemon must track pane lifecycle: seed from `herdr api snapshot`/`pane list`, then subscribe to `pane.created`/`pane.agent_detected` to add watches; drop on `pane.exited`/`pane.closed`.
3. Event payload identifies pane/kind/title, not always the worker *name* (`pm-event-sol` etc. live in `AgentInfo.name`); resolve via `agent.list`/`agent.get` when the digest is built.

---

## 3. (B) Durable queue — what exists / what's missing

**Nothing exists** (no queue file, no sqlite, no daemon, no launchd). Local capabilities verified: `node:sqlite` OK on Node v23.8.0, `python3` sqlite3 stdlib, `launchctl` available (no pm/herdr jobs installed).

Options:

| Option | Durability | Sequential guarantee | Cost | Verdict |
|---|---|---|---|---|
| **Append-only JSONL + fsync + cursor file** | fsync-before-ack; crash-safe with monotonic `id`; human-inspectable | single consumer + `flock(LOCK_EX)` on lockfile | ~50 LOC | ✅ recommended |
| SQLite (node:sqlite / python3) | WAL, transactional | same (one writer) | more deps/flags | optional upgrade if event volume grows |
| Herdr plugin command-per-event → append | same file semantics | same | spawns a process per event | acceptable v2 variant of the enqueue side |

Design invariants: `id` monotonic (per-daemon boot seq + timestamp), enqueue **before** any wake attempt, consumer moves cursor only after the wake turn finishes (success or recorded failure), poisoned/dead-letter file for events whose wake fails N times.

Queue location: `~/.local/state/pm-event-bridge/` (XDG state; avoids repo pollution and git-ignoring problems). The existing `plans/reports/herdr-*/ledger.md` run-ledger convention stays as the *human* audit trail; the daemon can append ledger lines per verdict.

---

## 4. (C) Wake / resume the Codex task — what exists

All verified from local `codex --help` trees and binary protocol strings (codex-cli 0.144.6):

1. **`codex exec resume [SESSION_ID] [PROMPT]`** — headless resume of an existing conversation, run one turn, exit. Flags: `--last`, `--json` (JSONL events), `-o/--output-last-message FILE`, `--ephemeral`, `-c key=value` overrides, sandbox/approval flags (`--dangerously-bypass-approvals-and-sandbox` etc.). Accepts UUID or thread name. **This is the recommended wake primitive.**
2. **`codex resume [SESSION_ID] [PROMPT]`** — interactive TUI resume (needs a terminal; not headless-wake suitable, but works if the manager is a TUI in a Herdr pane → then `herdr agent prompt <manager>` is the native wake instead).
3. **App-server v2 protocol (experimental)** — embedded method set extracted from the binary: `thread/start`, `thread/resume`, `thread/list`, `thread/read`, `thread/turns`, `thread/fork`, `thread/inject`, `thread/queue`, `thread/park`, `thread/rollback`; `turn/start`, `turn/steer`, `turn/interrupt`; notifications `turn/started`, `turn/completed`, `thread/started/closed/compacted…`. Daemon management: `codex app-server daemon start|stop|restart|bootstrap|enable-remote-control`, `codex app-server proxy --sock PATH`, TUI `--remote unix://PATH`. Strings also show **"cannot resume running thread"** — a thread held active by the Desktop app cannot be resumed concurrently by another app-server instance.
4. **Codex Desktop automation surface** — the running ChatGPT.app spawns its app-server with MCP `codex_app` tools: `create_thread`, **`send_message_to_thread`**, `fork_thread`, `handoff_thread` (approval_mode "prompt"). These are invocable **only from inside a Codex agent session**, not by an external bridge process. `~/.codex/ipc/ipc.sock` is owned by ChatGPT (PID 465) — an internal app channel, not a documented external API.
5. **`codex mcp-server`** — runs Codex itself as an MCP server (stdio); relevant only if the bridge itself were an MCP host; no documented resume-thread tool exposed there.
6. `notify` in `~/.codex/config.toml` fires on **turn-ended** (outbound hook) — not a wake mechanism.

### Gaps / risks in (C)

- **R1 — Desktop liveness conflict.** The ProjectManager thread lives in the Desktop app; if the app holds it running, concurrent `codex exec resume`/app-server `thread/resume` may fail or diverge ("cannot resume running thread" class). *Mitigation:* pin a **dedicated manager thread** for bridge wakes (bridge owns its lifecycle; user keeps Desktop for interactive use), or verify Desktop quiescence per wake.
- **R2 — Desktop UI refresh.** A headless `exec resume` appends to the rollout/thread store; the Desktop task view may not live-update mid-session. Acceptable (the review turn's outputs land in files/ledger), but must be stated to the user.
- **R3 — Sandbox vs herdr socket.** Default `codex exec` sandbox may block the unix-socket connect / spawn of `herdr` inside the wake turn. *Mitigation:* wake config uses explicit `-c sandbox_mode=…`/approval flags; verify once during Phase 1 (acceptance test A4).
- **R4 — Auth/model drift** (CLI auth vs Desktop login; `model_reasoning_effort` currently "low" in config) — pin `-m`/`-c` in the wake command; A5 test.

---

## 5. (D) browsermcp reconnect behavior — findings

Config: `~/.claude.json → mcpServers.browsermcp = {stdio, npx @browsermcp/mcp@latest}` (also reachable to pi via the `selected-mcp-bridge` extension). Package source (npx cache `@browsermcp/mcp`) shows:

- Architecture: stdio MCP server starts a **local WebSocket server on port 9009**; the Chrome extension connects to it; tool calls proxy to the tab and await a WS response (`WebSocket response timeout after {ms}` on failure).
- **Single-instance, port-killing startup:** `createWebSocketServer()` first runs `killProcessOnPort(9009)` → `lsof -ti:9009 | xargs kill -9`. Any second browsermcp start **kills the first server process**. Multiple concurrent agent sessions using browsermcp on one machine are therefore mutually destructive at startup.
- Reconnect semantics: a new extension WS connection **replaces** the old one (`if (context.hasWs()) context.ws.close()`); no message buffering, no durable delivery, no server-side auto-restart; `process.stdin` close tears everything down. If Chrome restarts, the extension must re-dial :9009; until then every tool call errors ("No tab is connected" / timeout).

**Verdict:** browsermcp is unsuitable as a wake/queue channel (fragile single instance, zero durability, UI-dependent). Keep it strictly as an optional *manual* observation tool. The bridge's critical path uses unix sockets and files only. (If Chrome-driven flows are ever needed for the manager, prefer the CDP-based `chrome-mcp`/realbrowser paths already configured — but out of scope here.)

---

## 6. Exists vs missing matrix

| Capability | Status | Evidence |
|---|---|---|
| Worker lifecycle push events (idle/done/blocked) | ✅ Herdr socket `events.subscribe` (live-validated) | §1 probe, §2.1 |
| Worker identity + report file convention | ✅ `agent.list/get`, `pm-owned` title stamps, `plans/reports/.../reports/<worker>.md` contract | pm-herdr-orchestration skill; snapshot titles |
| Pi-side richer hooks | ✅ extension API `agent_settled`, `turn_end`, `ui_prompt_*`; project-local load dir | §2.2 |
| Durable queue | ❌ missing → JSONL+fsync+cursor (§3) | grep/launchctl |
| Sequential single-consumer discipline | ❌ missing → flock + drain loop | — |
| Headless Codex wake | ✅ `codex exec resume --json -o` | §4.1 |
| Native Herdr alternative (plugin event hooks) | ✅ exists, usable as v2 enqueue side | §2.3 |
| Pi `blocked` → Herdr/queue wiring | ⚠️ partial gap (`herdr:blocked` emitter absent) | §2.4 |
| Daemon supervision | ❌ launchd user agent to add | `launchctl list` |
| browsermcp as transport | ❌ rejected (fragile, non-durable) | §5 |

---

## 7. Smallest reliable architecture (recommended)

```
                       ┌────────────────────────── pm-event-bridge daemon (node, single process, flock) ─────────────────────────┐
 Herdr server          │  capture: unix sock ~/.config/herdr/herdr.sock                                                   │
 (protocol 20) ──push──►  events.subscribe {pane.agent_status_changed, pane_id} per watched pane (+ pane.created/agent_detected)   │
 Pi workers   ──opt.──►  companion ext .pi/extensions/pm-event-bridge.ts: ui_prompt_* → blocked events; agent_settled → done      │
                       │  enqueue: append JSONL ~/.local/state/pm-event-bridge/queue.jsonl (id, ts, pane, agent, status, …) fsync │
                       │  drain: strict single loop; flock lock; cursor file; dead-letter after N fails; ledger.md append          │
                       │  wake: codex exec resume <MANAGER_THREAD> "<event digest + report path>" --json -o last-message.md        │
                       │        → awakened Codex reviews worker report, may `herdr agent start/prompt …` dispatch next reviewer    │
                       └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Why this shape: one process owns ordering end-to-end (capture→queue→wake), no polling anywhere, no new Herdr/Pi/Codex surface required, every failure mode degrades to "event stays queued / dead-lettered" rather than lost. Codex stays the decision-maker (review + dispatch) exactly as the pm-herdr-orchestration skill defines; the bridge only replaces the human/`agent wait` vigilance with an event-driven trigger.

Key behaviors to implement:

1. **Watch list seeding/filter:** only panes whose agent name matches `pm-*` or title starts `pm-owned` (title stamped via `pane report-metadata --source pm --title "pm-owned …"` per skill §2.3). Re-seed on `pane.created`/`pane.agent_detected`; unsubscribe-tracking is connection-scoped so a reconnect re-subscribes the current watch list (snapshot-derived).
2. **Reconnect:** on socket error/close → backoff (e.g. 1s→30s cap), reconnect, re-subscribe, and **reconcile via `herdr api snapshot`** (a state change that happened while disconnected is recovered here — this is the only "catch-up" read, event-driven, not periodic).
3. **Event normalization:** `{id, received_ts, pane_id, workspace_id, agent_kind, agent_name?, status(prev→new), title, source}`; only `working→{idle,done,blocked}` transitions enqueue (ignore working→working, idle→working churn except ledger trace).
4. **Digest per wake:** one line per pending event batch: worker name/pane, new status, absolute report path, deadline; instruct Codex to run the Review Gate and stop (its verdict is appended to the ledger by the bridge from `--output-last-message`).
5. **Sequential processing:** never start a second `codex exec resume` while one is running; queue absorbs bursts; optional coalescing (batch all events that arrived during a wake turn into the next digest) to avoid thundering wakes.
6. **Config:** `~/.local/state/pm-event-bridge/config.json` = `{herdr_socket, session:"default", workspace_number:1, manager_thread_id, watch_prefix:"pm-", queue_dir, codex_bin, wake_flags[]}`.
7. **Supervision (optional but recommended):** launchd user agent `~/Library/LaunchAgents/dev.pm.event-bridge.plist` with `KeepAlive=true` (daemon itself is the flock guard against doubles).

Explicitly **not** in scope/v1: Herdr plugin manifest (v2 alternative enqueue side), app-server `thread/inject`/`thread/queue` (experimental; revisit when CLI daemon stabilizes), browsermcp (rejected), any editing of `herdr-agent-state.ts` or Herdr config.

---

## 8. Risks (condensed)

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Desktop app holds manager thread running → exec-resume conflict/divergence | high | dedicated bridge-owned manager thread; per-wake quiescence check; document split (Desktop = interactive, bridge thread = review) |
| R2 | Wake-turn sandbox blocks herdr socket/exec | med | explicit `-c` sandbox/approval flags in wake command; A4 test |
| R3 | Events lost during Herdr restart/disconnect | med | reconnect+backoff+snapshot reconcile (§7.2); fsync'd queue |
| R4 | Duplicate wakes (done vs idle both fire) | low | transition normalization + coalescing; verdict idempotency (ledger keyed by event id) |
| R5 | pi `blocked` unreported (no emitter) | med | companion extension `ui_prompt_*` mapping; verify against Herdr screen-detection fallback |
| R6 | Concurrent browsermcp instances kill each other (:9009) | low (out of path) | keep browsermcp out of bridge; documented for other sessions |
| R7 | codex CLI version drift (app-server experimental) | low | pin to `codex exec resume` surface only; smoke-test in CI-like Phase 1 gate |
| R8 | Prompt injection via worker report content | med | digest carries **paths**, not worker prose; awakened Codex bound by skill's security policy (untrusted pane/report content; no secrets in prompts/ledger) |

---

## 9. Implementation plan

**Phase 0 — decisions (user):** manager thread strategy (dedicated bridge thread vs reuse Desktop thread — R1); queue location; launchd or manual start. No code.

**Phase 1 — capture skeleton (read-only against live Herdr):**
- `pm-event-bridge.mjs`: connect socket, seed watch list from `herdr api snapshot`, subscribe, log normalized events to stdout + queue file; SIGINT-safe.
- Acceptance: A1 kill/restart one test pane's agent (in a scratch pane owned by the run) and observe exactly one `working→idle|done` event enqueued with correct pane/agent; A2 stop/start Herdr server (`herdr server stop` is forbidden by skill — instead simulate by socket disconnect) → daemon reconnects and reconciles; A3 two simultaneous state changes → two queue lines, monotonic ids, no interleaved partial lines (`jq` per line).

**Phase 2 — sequential consumer + wake:**
- Drain loop, flock, cursor, dead-letter; wake via `codex exec resume`; parse `-o` last message; append ledger rows.
- Acceptance: A4 wake turn can execute `herdr --session default agent list` inside its sandbox (R2 cleared — else adjust flags); A5 wake uses intended model (`-m` pinned); A6 burst of 3 events during an active wake → 1 coalesced digest, sequential, no overlap (log timestamps prove ordering); A7 wake failure (bad thread id) → event dead-lettered after N attempts, queue continues.

**Phase 3 — pi-side enrichment (optional, fixes R5):**
- `.pi/extensions/pm-event-bridge.ts` (project-local; **never** edits `herdr-agent-state.ts`): `ui_prompt_start/end` → enqueue blocked/unblocked; `agent_settled` → enqueue done (dedupe vs Herdr event by pane+seq window).
- Acceptance: A8 worker hitting an approval UI produces a `blocked` queue event within ~2 s.

**Phase 4 — supervision + docs:** launchd plist, `plans/` runbook, ledger conventions; final review gate re-run of A1–A8.

Estimated sizes: daemon ~250 LOC (node, no deps beyond node:fs/net/child_process), extension ~80 LOC, plist ~20 LOC.

**Verification commands (existing surfaces):** `herdr api schema --json`, `herdr api snapshot`, `herdr agent wait <name> --until idle|done|blocked`, `codex exec resume --help`, `codex app-server daemon version`, `launchctl list | grep pm-event`.

---

## 10. Open questions

1. Manager-thread ownership (R1): dedicate a bridge-managed Codex thread, or accept Desktop-thread caveats? (User decision; A4/A6 depend on it.)
2. Does the Desktop app live-refresh rollout appends from `exec resume`? (Empirical check in Phase 2; cosmetic only.)
3. Should `blocked` events auto-wake the manager, or only enqueue + notify? (Skill says blocked → answer or ask user; auto-wake may be noise — recommend enqueue-only with digest flag `needs_human` for risky approvals.)
4. Is `done` vs `idle` distinction needed in dispatch policy (skill treats both as "settled")? Default: same handling.
5. Herdr plugin route as v2: confirm `HERDR_PLUGIN_CONTEXT_JSON` for event hooks carries pane_id/status (schema shows context shape; one empirical link test in Phase 3+ if adopted).

— End of report. Read-only constraint honored: only this file was written.
