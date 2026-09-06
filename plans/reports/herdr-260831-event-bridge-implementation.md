# Herdr→Codex Event Bridge — Phase 1+2 Implementation Report (Rework)

- **Date:** 2026-08-31 (rework pass + final-review blocker pass)
- **Spec:** `plans/reports/herdr-260831-0100-event-bridge-sol-review.md`
- **Rework driver:** `plans/reports/herdr-260831-event-bridge-review.md` (verdict REWORK, findings F1–F7)
- **Final-review driver:** `plans/reports/herdr-260831-event-bridge-final-review.md` (verdict REWORK, blockers F1/F3) — closed in §7 below
- **Status:** COMPLETE — seven original findings fixed **and** both final-review blockers (snake-case lifecycle discriminators, shutdown lock release) closed; **20/20 tests pass**, syntax clean. No live wake, no daemon/launchd, no browsermcp, no commit/push/deploy.
- **Ownership:** only `tools/pm-event-bridge/**` + this report were touched (`git status` confirms).

## 1. Finding-by-finding rework evidence

### F1 — exact Herdr 0.8.2 protocol-20 surface — FIXED
- Lifecycle subscriptions are now exactly the verified set: `pane.created`, `pane.agent_detected`, `pane.exited` (`lib/event-bridge.mjs` `LIFECYCLE_SUBSCRIPTIONS`); invented `pane.updated`/`pane.closed` removed.
- Identity resolution for lifecycle pushes uses the verified `session.snapshot` surface, event-driven (no invented `pane.get` call remains anywhere).
- Fake server is strict: rejects unknown methods (`method_not_found`) and any subscription type outside the verified allowlist, and requires `pane_id` on `pane.agent_status_changed` (`test/event-bridge.test.mjs` `FakeHerdrServer.#respond`).
- Test `F1: fake Herdr enforces the verified protocol surface and rejects invented ones` proves: `pane.updated` and pane_id-less status subscriptions are rejected, `pane.get` is rejected, and the bridge's own subscribe request contains exactly the four verified types.

### F2 — torn JSONL tail repair — FIXED
- New `repairJsonl` (`lib/io.mjs`): torn final bytes → durably quarantined to `<file>.torn-<ts>` (fsync) then file truncated to the last record boundary (fsync); a complete-but-unterminated final record gets a `\n` separator appended instead.
- `readJsonl` is now strict (throws on any malformed record) since repair always runs first; `DurableQueue` repairs both `queue.jsonl` and `dead-letter.jsonl` during init before reading.
- Tests: `F2: a torn final queue append is quarantined and truncated…` (good record + `{"id":2,"tor` → quarantine exists, file ends with newline, both lines parse standalone, torn record consumed no id) and `F2: a complete but unterminated final record gets a separator…`.

### F3 — lifetime exclusive instance lock / two-process exactly-once — FIXED
- `DurableQueue.acquireInstanceLock()/releaseInstanceLock()`: the bridge holds the exclusive `O_EXCL` lock for the entire process lifetime (`EventBridge.start()` acquires before any capture; `stop()` releases). The consumer reuses the held lock; a standalone consumer still falls back to per-drain acquire/release.
- Age-based reclaim removed — a stale lock is reclaimed only when the recorded PID is provably dead (`kill(pid,0)`), so a long live wake can never have its lock stolen.
- Test `F3: a second bridge instance cannot start; one process drains with exactly one wake`: instance B's `acquireInstanceLock` rejects with `ConsumerLockError`; A enqueues 2 events, drains with fake Codex → exactly **1** wake covering `event_id=1…2`, unique monotonic ids, cursor 2.

### F4 — recover dead-letter-before-cursor without wake — FIXED
- `DurableQueue` init now advances the cursor past any pending records whose ids are already in the durable dead-letter set, atomically (single checkpoint persist) before any consumer can drain.
- Test `F4: dead-lettered-but-uncursored events are recovered at init without any wake`: seeded crash state (dead-letter fsynced, cursor 0) → init → cursor 1, pending 0; a subsequent consumer drain performs **zero** fake-Codex spawns (state file never created).

### F5 — bounded child timeout with TERM/KILL + continuation — FIXED
- `spawnAndCollect` (`lib/wake-adapter.mjs`) arms `wakeTimeoutMs` (config, default 600 000) per attempt: on timeout it sends SIGTERM, then SIGKILL after `killGraceMs` (default 5 000); the attempt rejects with `ETIMEDOUT` (retryable), so the bounded retry → dead-letter → continuation chain holds for hung children.
- Config gains validated `wakeTimeoutMs` / `killGraceMs` fields.
- Test `F5: a hung wake child is TERM/KILLed, dead-lettered…`: first fake-Codex call hangs forever (`FAKE_CODEX_MODE=hang`, `HANG_UNTIL=1`), `wakeTimeoutMs:250`/`killGraceMs:150`, `maxBatchEvents:1` → drain terminates, dead-letter records `/timed out after 250ms/`, second event completes, cursor 2.

### F6 — prune stale watches on reconnect — FIXED
- `#applySnapshot` now re-derives the watch set from each fresh snapshot: watched ids absent from the snapshot are unsubscribed and their durable pane state removed; `DurableQueue.prunePaneStates(keepIds)` drops persisted state for gone panes (also fixes the restart-with-stale-state case).
- Test `F6: panes that disappear while disconnected are pruned…`: p1 watched → disconnect → snapshot without p1 → reconnect proves the new subscribe request no longer references p1 and `checkpoint.json` `panes` is empty.

### F7 — dry-run simulation cursor / no loss of future live delivery — FIXED
- Checkpoint gains `simCursor`. A dry-run consumer (`adapter.isDryRun()`) takes batches from `pendingSimulated()` (max of sim/live cursor) and advances only `simCursor`; live `cursor` stays behind. Promotion policy (documented in README): enabling live (config `dryRun:false` **and** `--enable-live-wake`) replays from the live cursor, delivering every dry-run-captured event exactly once. Batch keys are namespaced `sim:`/`live:` so retry counters don't cross modes.
- Tests: `F7: dry-run advances only the simulation cursor; later live wake delivers the same events` (cursor 0/simCursor 1 after dry-run; live wake then delivers, cursor 1, exactly 1 fake-Codex call) and `F7: CLI enforces the live double gate end to end` (config `dryRun:false` without the flag runs dry, CLI reports `"dryRun":true`, SIGTERM exits 0, checkpoint shows cursor 0 / simCursor 1).

## 2. Files (unchanged set, all inside ownership)

```
tools/pm-event-bridge/
├── pm-event-bridge.mjs          CLI (run | status | help); live double gate
├── config.example.json          no secrets; dryRun:true default
├── README.md                    + "Rework hardening (F1-F7)" section
├── lib/{config,event-bridge,herdr-socket,durable-queue,sequential-consumer,wake-adapter,io}.mjs
└── test/event-bridge.test.mjs   16 tests (7 original + 9 rework), strict fake protocol
```

## 3. Verification (exact commands, current tree)

1. `find tools/pm-event-bridge -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check` → **SYNTAX_OK** (every module).
2. `node --test tools/pm-event-bridge/test/*.test.mjs` → **16 tests, 16 pass, 0 fail** (~1.9 s):
   - 7 original behavior tests (capture/normalization, burst coalescing/no overlap, retry→dead-letter continuation, reconnect+reconcile, dry-run no-spawn, cold-start recovery, lock exclusivity) — updated where F7 legitimately changed cursor semantics (dry-run now asserts simCursor).
   - 9 rework tests: F1 ×1, F2 ×2, F3 ×1, F4 ×1, F5 ×1, F6 ×1, F7 ×2 (library + CLI double-gate).
3. CLI manual smoke (temp dir, fake socket, no live Herdr/Codex): `run` prints `{"status":"connected","dryRun":true,…}`, SIGTERM → exit 0.
4. `git status --short -- tools/pm-event-bridge plans/reports/herdr-260831-event-bridge-implementation.md` → only the owned paths appear; no other file modified by this rework.

## 4. Safety controls (unchanged + strengthened)

- DRY_RUN triple gate retained: code default `true`, config Boolean-validated, live additionally requires `--enable-live-wake`; dry-run now also preserves future live delivery (F7).
- Metadata-only digests with untrusted-content boundary (review: PASS) — untouched.
- No daemon/launchd installed or started; no live Herdr/Codex connection; browsermcp not used; no commit/push/deploy.

## 5. Limitations

1. Live-protocol validation against the real Herdr 0.8.2 server remains the first acceptance step of a later phase (per task constraints, fake-socket tests only). The adapter now uses exclusively review-verified wire surfaces, so residual risk is limited to payload field spellings (e.g. `state_change_seq` presence).
2. F7 promotion replays dry-run-captured events on first live run — intended and documented, but operators must expect that one-time replay wave.
3. Instance lock is `O_EXCL`+PID based (no flock(2) in Node stdlib); reclaim logic trusts PID liveness only.
4. Phase 3 (Pi extension `blocked` enrichment) and Phase 4 (launchd supervision) remain out of scope.

## 6. Unresolved questions

- None blocking; same two open product decisions as before (manager-thread strategy for the first live wake; whether `blocked` should auto-wake).

## 7. Final-review blocker pass (2026-08-31, closes final-review F1 + F3)

Driver: `plans/reports/herdr-260831-event-bridge-final-review.md` (verdict REWORK). Ownership respected: only `tools/pm-event-bridge/**` + this report changed; no other files touched, nothing reverted.

### 7.1 Schema evidence (read-only, bundled Herdr 0.8.2 protocol 20)

`herdr api schema --json` confirms two separate naming surfaces:

- **Request subscription selectors** are dotted consts in `$.schemas.request.$defs.Subscription`: `pane.created`, `pane.agent_detected`, `pane.exited`, `pane.agent_status_changed` — exactly the bridge's subscribe set (`LIFECYCLE_SUBSCRIPTIONS`).
- **Pushed event envelopes** are `EventEnvelope = {event: EventKind, data: EventData}` (both required) with **snake-case** discriminators in `EventKind`/`EventData.type`: `pane_created` (payload `{type, pane: PaneInfo}`), `pane_agent_detected` (`{type, pane_id, workspace_id, agent?, final_status?, released?}`), `pane_exited` (`{type, pane_id, workspace_id}`), `pane_agent_status_changed` (`{type, pane_id, workspace_id, agent_status, agent?, title?, …}`).
- Additionally, per-subscription pushes use `SubscriptionEventEnvelope` (`event` dotted: `pane.agent_status_changed`, `pane.scroll_changed`, `pane.output_matched`) whose `data` has **no** `type` field.

### 7.2 Final F1 — snake-case lifecycle discriminators + schema-faithful fake — FIXED

- `eventType()` in `lib/event-bridge.mjs` now treats request selectors and push envelopes as separate surfaces: dotted pushes (`pane.created` …) are normalized to snake; real snake pushes (`pane_created`, `pane_agent_detected`, `pane_exited`) pass through unchanged; `message.event` takes precedence with `data.type`/`type` as fallback. `#handleSocketEvent` resolves identity via `session.snapshot` for `pane_created`/`pane_agent_detected` and immediately drops watch + durable pane state on `pane_exited` (payload `{pane_id, workspace_id}` per schema).
- `HerdrSocketClient.#onData` emits push envelopes on `message.event` or `data.type` discriminator positions without conflating dotted selectors.
- Fake server is schema-faithful: `emitPush(event, data)` only accepts the four verified snake discriminators and frames them as real `EventEnvelope` lines `{event, data: {type, …}}`; dotted selector names can no longer masquerade as push discriminators (test `FakeHerdrServer.emitPush`).
- New tests (all schema-faithful payloads): `F1: schema-faithful pane_created push resolves snapshot identity and subscribes the new pane`, `F1: schema-faithful pane_agent_detected push resolves and watches a pm pane`, `F1: schema-faithful pane_exited push immediately removes watch and durable pane state`.
- **Final-review F6 side effect closed:** real `pane_exited` pushes now prune watch/state immediately (was "PARTIAL / BLOCKED BY F1").

### 7.3 Final F3 — stop()/init() lock boundary — FIXED

- `EventBridge.stop()` ordering is now: stop loop → close client → `await loopPromise` → `await captureTail` (serialized capture/checkpoint writes) → `await consumer.inFlight` (active wake; failure is logged, lock still not released mid-wake) → `releaseInstanceLock()`. The lifetime lock is never surrendered while a wake is in flight at an unadvanced cursor.
- `DurableQueue.acquireInstanceLock()` does only `ensureDir` + lockfile create **before** any mutable work, then runs `init()` under the held lock; `init()` outside an instance lock serializes its mutating repair/checkpoint persistence under a temporary exclusive lock. No JSONL repair or checkpoint persist can run while the real bridge owns the lock.
- New test `F3: stop holds lifetime lock through an in-flight wake; replacement cannot overlap or duplicate`: with a wake blocked mid-flight, a replacement bridge's `start()` rejects with `ConsumerLockError`, the cursor stays 0 while blocked, and after the wake settles and the lock releases, the replacement performs **zero** duplicate wakes (cursor already 1).

### 7.4 Verification (exact commands, current tree)

1. `find tools/pm-event-bridge -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check` → **SYNTAX_OK** (all modules).
2. `node --test tools/pm-event-bridge/test/*.test.mjs` → **20 tests, 20 pass, 0 fail** (~2.5 s): 16 previous (F1–F7 rework suite) + 3 schema-faithful F1 lifecycle tests + 1 stop-during-wake replacement test.
3. Bundled `herdr api schema --json` inspected read-only (§7.1); no live server action, no wake, no Codex spawn.
4. Node `v23.8.0`; probe artifacts under `/tmp` removed; `git status` shows only the owned untracked `tools/pm-event-bridge/` + `plans/reports/*` paths.

### 7.5 Known consequence (documented, not expanded in this pass)

- CLI `status` performs mutating init (repair/checkpoint persist), so while a bridge process holds the lifetime lock it fails fast with `ConsumerLockError` instead of mutating unlocked state — required by the final review's lock-boundary rule. A read-only status fallback can be added later if operators need live inspection; deliberately out of scope here.
