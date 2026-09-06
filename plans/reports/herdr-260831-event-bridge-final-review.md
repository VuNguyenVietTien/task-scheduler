# Sol/high Final Review — Herdr→Codex Event Bridge Rework

**Verdict: REWORK**  
**Date:** 2026-08-31  
**Mode:** independent read-only implementation review. No implementation/config edits, live wake, Herdr control action, daemon start, commit, push, or deploy.

## Reviewed scope

- `plans/reports/herdr-260831-event-bridge-review.md`
- `plans/reports/herdr-260831-event-bridge-implementation.md`
- bundled Herdr 0.8.2 protocol-20 JSON schema (`herdr api schema --json`)
- `tools/pm-event-bridge/**`

## Blocking findings

### F1 — HIGH: the strict fake still does not model real lifecycle event envelopes

The bundled Herdr 0.8.2 protocol-20 schema confirms that subscription selectors use dotted names such as `pane.created`, `pane.agent_detected`, and `pane.exited`. However, the corresponding generic pushed event envelope uses snake-case event/data discriminators: `pane_created`, `pane_agent_detected`, and `pane_exited`. Its lifecycle payloads also carry `data.type` in snake case.

The bridge subscribes with valid dotted selectors, but `#handleSocketEvent` only recognizes dotted lifecycle push names (`pane.created`, `pane.agent_detected`, `pane.exited`). It recognizes the snake-case alias only for `pane_agent_status_changed`. Therefore real schema-valid lifecycle pushes do not trigger snapshot identity resolution and do not remove exited panes.

The fake server masks the defect by emitting dotted values through `emitEvent('pane.agent_status_changed', ...)` and by treating dotted subscription selector names as if they were also the push-envelope event discriminators. Its claim to enforce the real protocol surface is incomplete.

Independent schema-valid probe:

```text
{"probe":"schema-valid-snake-lifecycle","watched":[],"trackedPanes":0}
```

A `pane_created` envelope followed by a snapshot containing a pm-owned worker should have added the pane. It was ignored.

**Required:** model request selectors and pushed event envelopes as separate schema surfaces; normalize/handle the real snake-case lifecycle event discriminators; test `pane_created`, `pane_agent_detected`, and `pane_exited` with schema-faithful payloads.

### F3 — HIGH: `stop()` releases the lifetime lock while a wake can still be in flight

`EventBridge.stop()` closes the socket, waits only for the connection loop, then releases the instance lock. It does not await `captureTail` or `consumer.inFlight`. A signal during a Codex wake can therefore release `consumer.lock` while that child is still running and before the live cursor advances. A replacement bridge can acquire the lock, read the old cursor, and wake the same batch concurrently.

Independent no-Codex/no-Herdr probe with a deliberately blocked injected wake adapter:

```text
{"probe":"stop-during-inflight-wake","secondAcquiredBeforeWakeFinished":true,"cursor":0}
```

This violates the process-lifetime single-consumer guarantee. The F3 test does not cover this path: it manually holds a queue lock and directly awaits a standalone consumer; it never stops `EventBridge` during an active wake and is not a two-process test.

There is a second lock-boundary weakness: `acquireInstanceLock()` calls `init()` before acquiring the lock. Consequently a competing bridge or `status` process can repair JSONL and persist a checkpoint while the real bridge owns the lock. Initialization is mutating and must not occur outside the exclusive boundary.

**Required:** acquire the exclusive lock before mutable queue initialization/capture, and during shutdown await serialized capture plus the active consumer/wake before releasing it (or cancel the wake and durably settle its state first). Add a signal-during-wake replacement-process test proving no overlapping/duplicate wake.

## Finding closure matrix

| Prior finding | Result | Evidence |
|---|---|---|
| F1 exact Herdr protocol | **OPEN** | Request selectors are valid, but real snake-case lifecycle push envelopes are ignored and the fake uses the wrong discriminator shape. |
| F2 torn-tail repair | **CLOSED** | Malformed final bytes are fsync-quarantined then the source is fsync-truncated; complete unterminated JSON gets a separator; both queue and dead-letter files are repaired before strict reads. Two focused tests pass. |
| F3 lifetime exclusivity | **OPEN** | Normal second acquisition rejects, but shutdown releases the lock during an in-flight wake; mutable `init()` also runs before lock acquisition. |
| F4 dead-letter crash safety | **CLOSED** | Initialization advances over a consecutive already-dead-lettered prefix before drain; exact fsync-before-cursor seeded test performs no wake. |
| F5 child timeout | **CLOSED** | Per-attempt timeout sends TERM then KILL after bounded grace, rejects as `ETIMEDOUT`, and enters retry/dead-letter/continuation. Hung-child test passes. |
| F6 reconnect pruning | **PARTIAL / BLOCKED BY F1** | Snapshot reconciliation prunes absent watched/state IDs and reconnect test passes, but real `pane_exited` pushes are ignored until a later reconnect/reconciliation. |
| F7 separate dry/live cursors | **CLOSED** | Dry-run advances `simCursor`, live delivery remains at `cursor`, retry keys are mode-separated, and later live drain delivers the event. Library and CLI double-gate tests pass. |

## Other accepted behavior

- Normal queue ordering, one-at-a-time wake execution, bounded retry, dead-letter continuation, dedupe, and atomic checkpoint replacement remain sound within one uninterrupted process.
- Metadata-only digest boundary remains sound: worker prose is not embedded, fields are bounded/single-line/ASCII-cleaned, and referenced content is labeled untrusted.
- Codex resume argv construction remains compatible with the reviewed CLI surface.
- The config + CLI live double gate prevents normal dry-run invocation from spawning Codex.
- Reconnect snapshot seeding and stale-state pruning are conceptually sound once real event discriminators are handled.

## Verification evidence

- Node `v23.8.0`.
- `node --check` for every `.mjs` file: **PASS**.
- `node --test tools/pm-event-bridge/test/*.test.mjs`: **PASS — 16/16**, with one Node warning that a test-created `FileHandle` was closed by garbage collection.
- `git diff --check -- tools/pm-event-bridge plans/reports/herdr-260831-event-bridge-implementation.md`: **PASS**.
- Bundled `herdr 0.8.2` protocol `20` schema inspected read-only; no live server action or wake.
- Temporary-directory schema-envelope and shutdown-lock probes reproduced F1 and F3 without repository source changes, live Herdr, or Codex.

## Final verdict

**REWORK.** F2, F4, F5, and F7 are closed, and F6 snapshot pruning works. Acceptance remains blocked because the fake protocol does not represent real lifecycle push discriminators and because graceful shutdown can surrender the exclusive lock while a wake remains active at an unadvanced cursor. Either defect can break event capture or exactly-once sequential wake behavior in production.

**Unresolved questions:** none.
