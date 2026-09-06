# PM Independent Review — Event Bridge Final Rework (Blocker Closure Verification)

**Verdict: ACCEPT**
**Date:** 2026-09-01
**Reviewer mode:** independent, read-only. Evidence restricted to `tools/pm-event-bridge/**`, `plans/reports/herdr-260831-event-bridge-final-review.md`, `plans/reports/herdr-260831-event-bridge-implementation.md`, and bundled Herdr CLI schema/help. No production code edits, no commit/push/deploy/delete, no live Herdr connection or wake. Probe artifacts lived in `/tmp` and were removed.

## Scope of verification

Acceptance required independent confirmation that both prior final-review blockers are genuinely closed:

1. **F1** — real snake_case lifecycle push discriminators handled separately from dotted subscribe selectors, with schema-faithful tests.
2. **F3** — `stop()`/`init()` lifetime lock cannot release while wake/capture is in flight; replacement bridge cannot overlap a settling wake.

## Blocker 1 (F1 snake lifecycle discriminators) — CLOSED

**Schema evidence (bundled `herdr 0.8.2`, protocol 20, `herdr api schema --json`):**

- Request subscription selectors are dotted consts in `$.schemas.request.$defs.Subscription` — pane set includes `pane.created`, `pane.agent_detected`, `pane.exited`, `pane.agent_status_changed`. The bridge's `LIFECYCLE_SUBSCRIPTIONS` + per-pane status subscriptions use exactly valid selectors.
- Generic push envelope `EventEnvelope = {event: EventKind, data: EventData}` (both required) with **snake_case** `EventKind` enum including `pane_created`, `pane_exited`, `pane_agent_detected`, `pane_agent_status_changed`. Payload shapes confirmed: `pane_created` → `{type, pane: PaneInfo}`; `pane_agent_detected` → `{type, pane_id, workspace_id, agent?, final_status?, released?}`; `pane_exited` → `{type, pane_id, workspace_id}`.
- Per-subscription pushes (`$.schemas.subscription_event`) use dotted `event` values (`pane.agent_status_changed`, `pane.scroll_changed`, `pane.output_matched`) whose `data` has **no** `type` field.

**Code evidence:**

- `lib/event-bridge.mjs` `eventType()` treats the two surfaces separately: dotted pushes normalize to snake (`pane.created` → `pane_created`, etc.); real snake discriminators pass through unchanged; `message.event` takes precedence with `data.type` as fallback. `#handleSocketEvent` resolves identity via `session.snapshot` for `pane_created`/`pane_agent_detected` and immediately drops watch + durable pane state on `pane_exited`. No invented methods remain (`pane.get` absent).
- `lib/herdr-socket.mjs` `#onData` emits push envelopes on `message.event` or snake `data.type` position without conflating dotted selectors.
- Test fake is schema-faithful: `FakeHerdrServer.emitPush` **rejects** any non-snake discriminator (dotted names can no longer masquerade as push events) and frames real `{event, data: {type, …}}` envelopes; the request-side allowlist rejects invented subscription types and pane_id-less status subscriptions.
- Three new tests use schema-exact payloads: `pane_created` (`{pane: {pane_id, workspace_id}}`), `pane_agent_detected` (`{pane_id, workspace_id}`), `pane_exited` (`{pane_id, workspace_id}`). All pass.

**Independent probe (own minimal schema-faithful fake server, no repo test code):**

```text
{"probe":"schema-valid-snake-lifecycle","watched":true,"captured":true,"trackedPanes":0}
```

A schema-valid `pane_created` envelope caused snapshot identity resolution + `pane.agent_status_changed` subscription; a `pane_agent_status_changed` envelope captured working→done; `pane_exited` removed tracked pane state. This reproduces and reverses the prior reviewer's probe (`watched:0/trackedPanes:0` failure).

## Blocker 2 (F3 stop/init lock boundary) — CLOSED

**Code evidence (`lib/event-bridge.mjs` `stop()`, `lib/durable-queue.mjs`):**

- `stop()` ordering: set `running=false` → resolve waiters → close client → `await loopPromise` → `await captureTail` (all serialized capture/checkpoint writes; no new captures possible after client destroy) → `await consumer.inFlight` (active drain/wake; failure logged but lock still not released mid-wake) → `releaseInstanceLock()`. The consumer drain, when the bridge holds the instance lock, reuses it and does not release per drain (`SequentialConsumer.#drain`).
- `DurableQueue.acquireInstanceLock()` now does only `ensureDir` + `O_EXCL` lockfile create **before** any mutable work, then runs `init()` under the held lock; standalone `init()` serializes its mutating repair/checkpoint persistence under a temporary exclusive lock (`#initializeExclusively`). Stale-lock reclaim is PID-liveness-only (no age rule), so a long live wake can never have its lock stolen.

**Independent probe (blocked wake adapter; corrected run):**

```text
{"probe":"stop-during-inflight-wake-v2","secondAcquiredBeforeWakeFinished":false,"cursorDuringStop":0,"wakeCallsWhileBlocked":1,"replacementDuplicateWakes":0,"finalCursor":1}
```

With a wake blocked mid-flight, a replacement bridge's `start()` rejected with `ConsumerLockError`, the cursor stayed 0 while blocked, exactly one wake ran, and after settle + release the replacement performed zero duplicate wakes with cursor 1. This reverses the prior reviewer's probe (`secondAcquiredBeforeWakeFinished:true`). (Note: my first probe attempt had a script-side bug — awaiting the promise resolver instead of the promise, racing stop's socket close — the corrected run above is the valid evidence. The repo's own `F3: stop holds lifetime lock…` test uses correct gating and passes.)

## Verification evidence

- Node `v23.8.0`.
- `find tools/pm-event-bridge -type f -name '*.mjs' -print0 | xargs -0 -n1 node --check` → **SYNTAX_OK** (all modules).
- `node --test tools/pm-event-bridge/test/*.test.mjs` → **20 tests, 20 pass, 0 fail** (~2.3 s), including all 16 prior rework tests (no regression) + 3 schema-faithful F1 lifecycle tests + 1 stop-during-wake replacement test.
- `herdr api schema --json` inspected read-only (protocol 20, schema_version 1); no live server action.
- Ownership: `git status` shows only `tools/pm-event-bridge/` (untracked) + `plans/reports/*`; no other paths touched by the rework. Tree is untracked, so no textual `git diff` vs. prior revision was possible; code-vs-report comparison found the implementation matches §7.1–§7.3 claims.

## Non-blocking findings (notes, no action required for acceptance)

1. **Minor — stale-lock reclaim TOCTOU (`DurableQueue.#removeStaleLock`):** two concurrent processes can both observe a dead-PID stale lock; between one contender's re-check and `rm`, another could acquire the fresh lock, and the loser's `rm` may delete it. Window is small and requires a dead holder plus simultaneous contenders; PID-liveness-only reclaim is already a documented limitation (§5.3). Suggest rename-based steal or re-verify after `rm` in a later pass.
2. **Accepted consequence — `status` CLI fails fast** with `ConsumerLockError` while the bridge holds the lifetime lock (documented §7.5). Read-only status fallback deferred; fine for now.
3. **Note — schema breadth:** `EventKind` also defines `pane_closed`/`pane_updated`; the bridge deliberately ignores them (not subscribed; `pane_exited` drives lifecycle removal). Consistent with the verified subscription set; no invented surface.
4. **Note — dry-run promotion replay** (F7) intentionally replays dry-run-captured events on first live run; operator-facing and documented in README.

## Verdict

**ACCEPT.** Both final-review blockers are genuinely and independently closed: schema-faithful snake-case lifecycle push handling with a strict dual-surface fake (F1), and a stop/init lifetime lock that provably cannot release while capture/wake is in flight with zero replacement overlap (F3). The prior closed findings (F2, F4, F5, F6, F7) remain closed — their test suites still pass unchanged. Syntax clean, 20/20 tests pass, no regressions detected.

**Unresolved questions:** none.
