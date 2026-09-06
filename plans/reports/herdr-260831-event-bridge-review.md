# Sol/high Independent Review — Herdr→Codex Event Bridge

**Verdict: REWORK**  
**Date:** 2026-08-31  
**Mode:** read-only. No code edits, live wake, Herdr control action, or daemon start.

## Reviewed scope

- `plans/reports/herdr-260831-event-bridge-implementation.md`
- `plans/reports/herdr-260831-0100-event-bridge-sol-review.md`
- `tools/pm-event-bridge/**`

## Blocking findings

### F1 — HIGH: fake Herdr protocol does not enforce the reviewed Herdr 0.8.2 wire contract

The reviewed protocol evidence identifies lifecycle subscriptions `pane.created`, `pane.agent_detected`, and `pane.exited`, and identifies `agent.list`/`agent.get` for identity resolution. The implementation instead sends one initial subscription containing `pane.updated` and `pane.closed` (`lib/event-bridge.mjs:9-15`) and resolves partial lifecycle events through `pane.get` (`:270`). Those shapes are not established by the source review.

The fake server accepts every subscription type without schema validation and implements the invented `pane.get` method (`test/event-bridge.test.mjs:119-129`). Therefore all seven tests can pass even if the real 0.8.2 server rejects the initial subscription or lifecycle lookup. Because all subscriptions are sent in one request, one unsupported type can prevent the bridge from reaching its ready state.

**Required:** conform the adapter and fake server to the exact protocol-20 request/event schema from the source review; subscribe to the verified exit event; use a verified lookup surface; make the fake reject unknown methods and subscription types.

### F2 — HIGH: a torn final queue append is ignored but never repaired, so replay corrupts the queue

`readJsonl` ignores a malformed non-newline-terminated final record (`lib/io.mjs:22-45`). It does not truncate that torn suffix or insert a separator. On restart, `appendJsonl` opens the same file in append mode (`:10-19`), so replay appends the next valid JSON object directly after the partial object. The combined line then becomes a permanent malformed complete record.

Independent crash probe:

```text
{"probe":"torn-tail-replay","outcome":"Invalid JSONL record ... at line 1 ..."}
```

This directly contradicts the implementation report’s crash-safe torn-line claim.

**Required:** detect and durably truncate/quarantine the incomplete final bytes before accepting new appends, then test crash → restart → replay → drain.

### F3 — HIGH: the lock serializes consumers temporarily but does not provide a single bridge/consumer guarantee

The consumer lock is acquired only inside each `drain()` and released whenever the queue becomes empty (`lib/sequential-consumer.mjs:30-62`). Queue/checkpoint state is cached independently in every `DurableQueue` instance. A second process can initialize with cursor 0, wait until the first releases the lock after completing event 1, then acquire the lock and wake event 1 again from its stale cursor.

Independent public-API probe with two initialized queue instances:

```text
{"probe":"sequential-two-instances","wakes":2,"cursorA":1,"cursorB":1}
```

Capture/enqueue mutations also have only an in-process promise chain (`lib/durable-queue.mjs:243-254`), so two foreground bridge processes can race on `nextId`, dedupe, append, and checkpoint writes. The README claim that the consumer lock prevents a second instance is false.

The six-hour age rule can additionally reclaim a lock from a still-live long wake, after which the original owner can remove the replacement owner’s lock during release.

**Required:** hold an exclusive instance/consumer lock for the process lifetime, or re-read/transactionally lock all queue state after every acquisition and cross-process enqueue mutation. Add a two-process test proving exactly one wake and monotonic unique IDs.

### F4 — HIGH: dead-letter fsync→cursor crash re-wakes an already dead-lettered batch

`deadLetter` correctly fsyncs the dead-letter record before advancing the cursor. However, after a crash between those operations, initialization remembers dead-lettered IDs (`lib/durable-queue.mjs:101-103`) while `pending()` still returns them (`:159-163`). `SequentialConsumer` always attempts a wake before consulting the attempt limit/dead-letter state (`lib/sequential-consumer.mjs:38-55`).

Independent simulated crash probe (dead-letter record durable, cursor still 0, retry count already max):

```text
{"probe":"dead-letter-before-cursor-crash","wakeCalls":1,"status":{"cursor":1,"deadLetterBatches":1,...}}
```

The queue eventually continues, but only after an unintended extra Codex resume attempt. That violates the claimed crash-safe retry/dead-letter behavior.

**Required:** on recovery, atomically advance past already dead-lettered IDs without another wake, and add the exact fsync-before-cursor crash test.

### F5 — HIGH: a hung Codex child defeats bounded retry and continuation

`spawnAndCollect` has no wake timeout or cancellation (`lib/wake-adapter.mjs:64-87`). A Codex process that never exits holds the one consumer forever; attempts never increment to failure, no dead letter is written, and later events never drain. The retry policy is bounded only for subprocesses that terminate.

**Required:** add a configurable per-attempt timeout, terminate then force-kill the child with a bounded grace period, classify timeout as a retryable failure, and test continuation after a hung fake Codex process.

### F6 — MEDIUM: reconnect reconciliation retains panes that disappeared while disconnected

`this.watched` survives reconnects. `#applySnapshot` only adds panes and never removes watched IDs absent from the new snapshot (`lib/event-bridge.mjs:158-180`). The next subscription request is built from the stale set (`:161-165`). A pane that exits while disconnected remains tracked; a real server may reject subscription to the nonexistent pane, causing a reconnect loop. Persisted pane state is likewise not pruned after a bridge restart unless an exit event was observed.

**Required:** derive the reconnect watch set from the new snapshot, reconcile removed panes/state, then subscribe. Add a disconnect → pane disappears → reconnect test.

### F7 — MEDIUM: default dry-run drains and acknowledges events, preventing later live delivery

The CLI live double gate is correctly implemented, but dry-run `wake()` returns a success-like result (`lib/wake-adapter.mjs:103-109`) and the consumer immediately calls `queue.complete` (`lib/sequential-consumer.mjs:40-43`). Existing dry-run bridge tests explicitly observe cursor advancement. Since dry-run is the default, a safe validation run marks every captured event consumed; enabling live wake later will not deliver those retained-but-behind-cursor events.

**Required:** do not advance the live-delivery cursor for dry-run plans, or maintain a separate simulation cursor and document an explicit promotion/replay policy. Add a CLI-level test for both opt-ins and subsequent live visibility of dry-run-captured events.

## Accepted behavior

### Normal-path durability and ordering — PASS with crash blockers above

- Queue append is fsynced before checkpoint acknowledgement.
- Checkpoint replacement fsyncs the file and best-effort syncs the parent directory.
- In one process, mutations serialize and batch prefixes preserve ID order.
- Burst test proves fake wake subprocesses do not overlap.

### Normal retry/dead-letter continuation — PASS

The finite-failure test proves two failed attempts dead-letter event 1 and allows event 2 to continue. F4/F5 block crash/hang reliability.

### Dedupe/cursor normal cases — PASS

- Sequence-based/fallback transition keys suppress ordinary duplicate settled pushes.
- Queue reconstruction restores dedupe after a clean restart.
- F2–F4 block the required crash cases.

### Metadata-only prompt-injection boundary — PASS

`makeWakeDigest` includes only bounded, single-line ASCII metadata and report paths; it does not read or embed worker prose. The digest explicitly marks metadata/referenced reports as untrusted and forbids following embedded instructions (`lib/wake-adapter.mjs:5-48`).

### Codex resume argv — PASS

The generated order matches the installed CLI surface:

```text
codex exec resume <SESSION_ID> <PROMPT> --json -o <FILE> -m <MODEL>
  -c model_reasoning_effort=<VALUE> -c sandbox_mode=<VALUE> ...
```

`codex exec resume --help` reports `Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]`. A no-execution `--help` parse using the generated post-positional option order exited 0 and created no output file.

### DRY_RUN/live double gate — PASS for spawn prevention

- Config defaults `dryRun:true` and validates it as Boolean.
- CLI only sets live mode when config has `dryRun:false` **and** `--enable-live-wake` is present; `--dry-run` overrides both.
- Adapter checks dry-run before `mkdir` or `spawn`.
- F7 concerns cursor/delivery semantics, not process-spawn safety.

## Verification evidence

- Node: `v23.8.0`.
- `node --check` over every `.mjs` file → **PASS**.
- `node --test tools/pm-event-bridge/test/*.test.mjs` → **PASS: 7 passed, 0 failed**.
- `git diff --check -- tools/pm-event-bridge plans/reports/herdr-260831-event-bridge-implementation.md` → **PASS**.
- Codex argv help/parse probe → **PASS**, no wake and no output file.
- Three temporary-directory crash/concurrency probes reproduced F2, F3, and F4 without touching live Herdr/Codex or repository source.

## Final verdict

**REWORK.** Syntax and the seven happy-path/fake-protocol tests pass, and the metadata boundary, argv construction, normal ordering, retry continuation, and double spawn gate are sound. Acceptance is blocked by unverified/wrong Herdr wire surfaces, unrepaired torn JSONL tails, duplicate wakes across bridge instances, dead-letter crash replay, lack of wake timeout, stale reconnect watches, and dry-run consuming live delivery state.

**Unresolved questions:** none; required rework is testable without live wake or daemon installation.
