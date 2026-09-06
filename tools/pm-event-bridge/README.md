# pm-event-bridge

Event-driven bridge from Herdr pm-owned worker panes to a Codex manager thread.
Node.js standard library only — zero npm dependencies. Implements Phase 1+2 of
`plans/reports/herdr-260831-0100-event-bridge-sol-review.md`:

1. **Capture (push-only):** connects to the Herdr Unix socket, seeds the watch
   list from one `session.snapshot`, subscribes to `pane.agent_status_changed`
   per watched pane plus pane lifecycle events (`pane.created`, `pane.updated`,
   `pane.agent_detected`, `pane.closed`) to add/remove watches dynamically.
   No periodic polling anywhere.
2. **Durable queue:** every meaningful `working → idle|done|blocked` transition
   is appended to an fsync'd JSONL queue before acknowledgement, with a durable
   cursor/checkpoint, persistent dedupe keys, and crash-safe recovery.
3. **Single consumer:** one strictly sequential drain loop guarded by an
   exclusive consumer lock. Bursts are coalesced into the next wake digest;
   wake subprocesses never overlap. Failed wakes retry with bounded backoff,
   then are dead-lettered and processing continues.
4. **Wake adapter:** builds `codex exec resume <manager-thread-id> <digest>
   --json -o <file>` with configurable binary/model/reasoning/sandbox flags.
   **`dryRun: true` is the hard default** — a real Codex process additionally
   requires `dryRun: false` in config *and* the `--enable-live-wake` CLI flag.
5. **Reconnect:** socket close/error triggers bounded exponential backoff,
   re-subscription, and a snapshot reconciliation (the only catch-up read).
   A `working → settled` change that happened while disconnected is recovered
   from the durable per-pane status; a fresh snapshot never invents a wake.

## Files

```
pm-event-bridge.mjs        CLI entry point (run | status | help)
lib/config.mjs             Config loading + validation
lib/event-bridge.mjs       Capture orchestration (socket → normalize → queue)
lib/herdr-socket.mjs       Newline-delimited JSON-RPC Unix socket client (injectable)
lib/durable-queue.mjs      fsync JSONL queue, cursor, dedupe, retries, dead-letter, lock
lib/sequential-consumer.mjs  One-at-a-time drain with coalescing and retries
lib/wake-adapter.mjs       codex exec resume invocation builder + runner
lib/io.mjs                 Atomic JSON writes, JSONL append/read, backoff helpers
test/event-bridge.test.mjs Fake-socket + fake-codex integration tests
config.example.json        Example configuration (no secrets, safe defaults)
```

## Usage

```bash
# Inspect queue state (never spawns Codex)
node pm-event-bridge.mjs status --config /absolute/path/config.json

# Foreground capture + drain. Ctrl+C to stop. Dry-run wakes only.
node pm-event-bridge.mjs run --config /absolute/path/config.json

# Force dry-run regardless of config (safest)
node pm-event-bridge.mjs run --config /absolute/path/config.json --dry-run

# Real wakes: requires config dryRun:false AND this flag (both, deliberately)
node pm-event-bridge.mjs run --config /absolute/path/config.json --enable-live-wake
```

No daemon is installed or started. `run` is foreground-only; process exit
(SigINT/SIGTERM) stops capture. The consumer lock prevents a second instance.

## Configuration

Copy `config.example.json`, then set:

| Field | Meaning |
|---|---|
| `herdrSocket` | Absolute path to the Herdr Unix socket (e.g. `~/.config/herdr/herdr.sock`) |
| `queueDir` | Directory for `queue.jsonl`, `dead-letter.jsonl`, `checkpoint.json`, `consumer.lock` |
| `managerThreadId` | Codex thread/session id passed to `exec resume` |
| `codexBin` / `codexPrefixArgs` | Codex executable and prefixed args (e.g. a wrapper path) |
| `model` / `reasoning` / `sandbox` | Optional `-m`, `-c model_reasoning_effort=`, `-c sandbox_mode=` |
| `extraArgs` | Extra trailing CLI args |
| `dryRun` | **Default `true`.** `false` only logs-plans no process unless `--enable-live-wake` is also passed |
| `watchPrefix` | Agent-name prefix watched (default `pm-`); titles must start `pm-owned` |
| `reportDirectory` | Absolute dir used to build `<agent>.md` report paths in digests |
| `maxAttempts`, `retryBaseMs`, `retryMaxMs` | Wake retry policy |
| `reconnectBaseMs`, `reconnectMaxMs` | Socket reconnect backoff |
| `maxBatchEvents` | Max events coalesced into one wake digest |

No secrets belong in this file; it contains only local paths, ids, and flags.

## Tests

```bash
node --test tools/pm-event-bridge/test/*.test.mjs
```

Tests use a fake Herdr Unix socket server and a fake Codex executable — no
live Herdr server, no real Codex, no network. They prove: push capture +
durable queue, burst coalescing without overlapping wakes, retry → dead-letter
→ continuation, reconnect + re-subscribe + snapshot reconciliation, dry-run
never spawning, cold-start recovery from durable state, and lock exclusivity.

## Rework hardening (F1-F7)

- **F1 exact protocol:** only the verified Herdr 0.8.2 protocol-20 surfaces are used — `session.snapshot`, `events.subscribe`, and the lifecycle subscriptions `pane.created` / `pane.agent_detected` / `pane.exited`. Lifecycle identity resolution goes through a snapshot read triggered by the push (no invented `pane.get`). The fake test server rejects unknown methods and subscription types.
- **F2 torn-tail repair:** on init, a partially written final JSONL record is durably quarantined to `<file>.torn-<ts>` and the file is truncated to the last acknowledged record; a complete but unterminated final record gets a separator. Replay then appends clean standalone lines.
- **F3 single instance:** the bridge acquires the exclusive lock for the whole process lifetime (start→stop); stale locks are reclaimed only when the holder PID is provably dead (no age rule). A second bridge process fails to start.
- **F4 crash recovery:** events already dead-lettered but not yet cursor-advanced are skipped atomically at init — no re-wake after a dead-letter/cursor crash window.
- **F5 wake timeout:** each wake attempt runs under `wakeTimeoutMs` (default 600s) with SIGTERM then SIGKILL after `killGraceMs`; a timeout is a retryable failure, so bounded retry/dead-letter/continuation still holds for hung children.
- **F6 stale watches:** every reconnect re-derives the watch set from the fresh snapshot; panes that disappeared while disconnected are unsubscribed and their durable pane state is pruned.
- **F7 dry-run cursor:** dry-run completions advance a separate `simCursor`; the live `cursor` stays put, so promoting to live (config `dryRun:false` + `--enable-live-wake`) delivers every dry-run-captured event exactly once.

## Limitations

- The Herdr wire framing (newline-delimited JSON, `session.snapshot`,
  `events.subscribe`, `{event, data}` push envelopes) follows Herdr 0.8.2
  protocol 20 as documented in the reviewed spec; it is isolated in
  `lib/herdr-socket.mjs` + `lib/event-bridge.mjs` adapters and covered by the
  fake-protocol tests, but has not been validated against the live server.
- Wake verification against a real Codex thread is intentionally out of scope
  (DRY_RUN default; no live wake was performed).
- `agent_name` resolution relies on snapshot/pane payloads carrying `name`;
  some Herdr versions may need an extra `agent.get` lookup.
- No launchd/systemd supervision by design (Phase 4).
