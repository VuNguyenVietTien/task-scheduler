import { open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  appendJsonl,
  ensureDir,
  readJson,
  readJsonl,
  repairJsonl,
  sha256,
  writeJsonAtomic,
} from './io.mjs';

const STATE_VERSION = 1;

export class ConsumerLockError extends Error {
  constructor(lockPath) {
    super(`Another consumer holds ${lockPath}`);
    this.name = 'ConsumerLockError';
  }
}

function defaultState() {
  return {
    version: STATE_VERSION,
    nextId: 1,
    cursor: 0,
    simCursor: 0,
    panes: {},
    dedupe: {},
    retries: {},
  };
}

function normalizeState(value) {
  const state = { ...defaultState(), ...(value ?? {}) };
  if (state.version !== STATE_VERSION) {
    throw new Error(`Unsupported queue state version: ${state.version}`);
  }
  if (!Number.isInteger(state.nextId) || state.nextId < 1) state.nextId = 1;
  if (!Number.isInteger(state.cursor) || state.cursor < 0) state.cursor = 0;
  if (!Number.isInteger(state.simCursor) || state.simCursor < 0) state.simCursor = 0;
  state.panes ??= {};
  state.dedupe ??= {};
  state.retries ??= {};
  return state;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export class DurableQueue {
  constructor(directory, { lockStaleMs = 6 * 60 * 60 * 1000 } = {}) {
    this.directory = path.resolve(directory);
    this.paths = {
      queue: path.join(this.directory, 'queue.jsonl'),
      deadLetter: path.join(this.directory, 'dead-letter.jsonl'),
      checkpoint: path.join(this.directory, 'checkpoint.json'),
      lock: path.join(this.directory, 'consumer.lock'),
    };
    this.lockStaleMs = lockStaleMs;
    this.state = defaultState();
    this.deadLettered = new Set();
    this.initialized = false;
    this.initializing = undefined;
    this.mutationTail = Promise.resolve();
    // F3: process-lifetime exclusive lock. Held from bridge start to stop so a
    // second bridge process cannot interleave stale cursor state with ours.
    this.instanceLock = undefined;
    this.repairs = [];
  }

  async init() {
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    // F3.2: initialization repairs JSONL and persists a checkpoint, so it is
    // itself a mutation. When no lifetime bridge lock exists, serialize that
    // setup under a temporary exclusive lock rather than mutating unlocked.
    this.initializing = this.#initializeExclusively();
    try {
      await this.initializing;
    } finally {
      this.initializing = undefined;
    }
  }

  async #initializeExclusively() {
    if (this.instanceLock) return this.#initialize();
    await ensureDir(this.directory);
    const initializationLock = await this.#acquireLock(false);
    try {
      await this.#initialize();
    } finally {
      await initializationLock.release();
    }
  }

  async #initialize() {
    await ensureDir(this.directory);
    // F2: repair torn JSONL tails before reading or appending anything.
    for (const file of [this.paths.queue, this.paths.deadLetter]) {
      const result = await repairJsonl(file);
      if (result.repaired) this.repairs.push({ file, ...result });
    }
    this.state = normalizeState(await readJson(this.paths.checkpoint, defaultState()));

    const records = await readJsonl(this.paths.queue);
    let maximumId = 0;
    for (const record of records) {
      if (!Number.isInteger(record.id) || record.id < 1) {
        throw new Error(`Queue record has invalid id: ${JSON.stringify(record)}`);
      }
      maximumId = Math.max(maximumId, record.id);
      if (record.dedupeKey && !this.state.dedupe[record.dedupeKey]) {
        this.state.dedupe[record.dedupeKey] = record.id;
      }
    }
    this.state.nextId = Math.max(this.state.nextId, maximumId + 1);
    if (this.state.cursor > records.length) this.state.cursor = records.length;

    for (const deadLetter of await readJsonl(this.paths.deadLetter)) {
      for (const id of deadLetter.eventIds ?? []) this.deadLettered.add(id);
    }

    // F4: a crash between the dead-letter fsync and the cursor advance leaves
    // already-dead-lettered records ahead of the cursor. Recover by advancing
    // past them now, atomically, so no consumer ever re-wakes them.
    let recoveredCursor = this.state.cursor;
    const allRecords = await readJsonl(this.paths.queue);
    while (recoveredCursor < allRecords.length && this.deadLettered.has(allRecords[recoveredCursor].id)) {
      recoveredCursor += 1;
    }
    this.state.cursor = recoveredCursor;

    await this.#persist();
    this.initialized = true;
  }

  async enqueue(event) {
    await this.init();
    return this.#mutate(async () => {
      const dedupeKey = event.dedupeKey ?? sha256(JSON.stringify({
        paneId: event.paneId,
        previousStatus: event.previousStatus,
        status: event.status,
        transition: event.transition,
      }));
      const knownId = this.state.dedupe[dedupeKey];
      if (knownId) return { enqueued: false, id: knownId, dedupeKey };

      const record = {
        id: this.state.nextId,
        receivedAt: new Date().toISOString(),
        ...event,
        dedupeKey,
      };

      // The queue line is the source of truth. Its fsync happens before the
      // checkpoint makes the event visible as deduplicated or advances nextId.
      await appendJsonl(this.paths.queue, record);
      this.state.nextId += 1;
      this.state.dedupe[dedupeKey] = record.id;
      await this.#persist();
      return { enqueued: true, id: record.id, record, dedupeKey };
    });
  }

  getPaneState(paneId) {
    const value = this.state.panes[paneId];
    return value ? { ...value } : undefined;
  }

  async setPaneState(paneId, value) {
    await this.init();
    return this.#mutate(async () => {
      this.state.panes[paneId] = { ...value, updatedAt: new Date().toISOString() };
      await this.#persist();
    });
  }

  async removePaneState(paneId) {
    await this.init();
    return this.#mutate(async () => {
      delete this.state.panes[paneId];
      await this.#persist();
    });
  }

  async pending(limit = Infinity) {
    await this.init();
    const records = await readJsonl(this.paths.queue);
    return records.slice(this.state.cursor, this.state.cursor + limit);
  }

  async pendingSimulated(limit = Infinity) {
    await this.init();
    const records = await readJsonl(this.paths.queue);
    const start = Math.max(this.state.simCursor, this.state.cursor);
    return records.slice(start, start + limit);
  }

  async recordRetry(batchKey, attempt, error) {
    await this.init();
    return this.#mutate(async () => {
      this.state.retries[batchKey] = {
        attempts: attempt,
        lastFailureAt: new Date().toISOString(),
        lastError: String(error?.message ?? error).slice(0, 2_000),
      };
      await this.#persist();
    });
  }

  retryCount(batchKey) {
    return this.state.retries[batchKey]?.attempts ?? 0;
  }

  async complete(records, batchKey, { simulated = false } = {}) {
    await this.init();
    return this.#mutate(() => this.#advance(records, batchKey, simulated));
  }

  async deadLetter(records, batchKey, error, { simulated = false } = {}) {
    await this.init();
    return this.#mutate(async () => {
      const eventIds = records.map((record) => record.id);
      const allAlreadyRecorded = eventIds.every((id) => this.deadLettered.has(id));
      if (!allAlreadyRecorded) {
        await appendJsonl(this.paths.deadLetter, {
          deadLetteredAt: new Date().toISOString(),
          batchKey,
          eventIds,
          attempts: this.retryCount(batchKey),
          simulated,
          error: String(error?.message ?? error).slice(0, 2_000),
          events: records,
        });
        for (const id of eventIds) this.deadLettered.add(id);
      }
      await this.#advance(records, batchKey, simulated);
    });
  }

  // F3: acquire once per process, before any mutable initialization/capture;
  // released only after EventBridge shutdown has settled capture and wake work.
  async acquireInstanceLock() {
    if (this.instanceLock) return this.instanceLock;
    // Creating the state directory is the minimal bootstrap needed to create
    // its lockfile; all queue/checkpoint repair follows only after the lock.
    await ensureDir(this.directory);
    const lock = await this.#acquireLock(false);
    this.instanceLock = lock;
    try {
      await this.init();
      return lock;
    } catch (error) {
      this.instanceLock = undefined;
      await lock.release();
      throw error;
    }
  }

  async releaseInstanceLock() {
    const lock = this.instanceLock;
    this.instanceLock = undefined;
    if (lock) await lock.release();
  }

  async acquireConsumerLock() {
    await this.init();
    return this.#acquireLock(false);
  }

  async status() {
    await this.init();
    const records = await readJsonl(this.paths.queue);
    const deadLetters = await readJsonl(this.paths.deadLetter);
    return {
      directory: this.directory,
      totalEvents: records.length,
      cursor: this.state.cursor,
      simCursor: this.state.simCursor,
      pendingEvents: Math.max(0, records.length - this.state.cursor),
      pendingSimulated: Math.max(0, records.length - Math.max(this.state.simCursor, this.state.cursor)),
      deadLetterBatches: deadLetters.length,
      nextId: this.state.nextId,
      trackedPanes: Object.keys(this.state.panes).length,
      dedupeKeys: Object.keys(this.state.dedupe).length,
      repairs: this.repairs,
    };
  }

  // F6: drop tracked pane state for panes absent from a fresh snapshot.
  async prunePaneStates(keepPaneIds) {
    await this.init();
    const keep = new Set(keepPaneIds);
    return this.#mutate(async () => {
      for (const paneId of Object.keys(this.state.panes)) {
        if (!keep.has(paneId)) delete this.state.panes[paneId];
      }
      await this.#persist();
    });
  }

  async #advance(records, batchKey, simulated = false) {
    await this.init();
    if (!records.length) return;
    const all = await readJsonl(this.paths.queue);
    const current = simulated ? Math.max(this.state.simCursor, this.state.cursor) : this.state.cursor;
    const expected = records.map((record) => record.id).join(',');
    const actual = all.slice(current, current + records.length).map((record) => record.id).join(',');
    if (expected !== actual) {
      throw new Error(`Queue cursor changed while processing batch ${batchKey}`);
    }
    if (simulated) this.state.simCursor = current + records.length;
    else this.state.cursor = current + records.length;
    delete this.state.retries[batchKey];
    await this.#persist();
  }

  async #persist() {
    await writeJsonAtomic(this.paths.checkpoint, this.state);
  }

  // Serializes all state mutations in-process. The cross-process guarantee is
  // the consumer lock; concurrent enqueues from the capture path still need
  // strict ordering so IDs and the checkpoint stay consistent.
  #mutate(operation) {
    const run = this.mutationTail.then(operation, operation);
    this.mutationTail = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  async #acquireLock(retriedStaleLock) {
    let handle;
    try {
      handle = await open(this.paths.lock, 'wx', 0o600);
      const payload = {
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      };
      await handle.writeFile(`${JSON.stringify(payload)}\n`, 'utf8');
      await handle.sync();
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (error.code !== 'EEXIST') throw error;

      if (!retriedStaleLock && await this.#removeStaleLock()) {
        return this.#acquireLock(true);
      }
      throw new ConsumerLockError(this.paths.lock);
    }

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        await handle.close();
        await rm(this.paths.lock, { force: true });
      },
    };
  }

  async #removeStaleLock() {
    let metadata;
    try {
      metadata = await readFile(this.paths.lock, 'utf8').then((text) => JSON.parse(text)).catch(() => undefined);
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      return false;
    }

    // F3: reclaim only when the holder process is provably dead. No age rule:
    // a long live wake must never have its lock stolen by age.
    if (!processIsAlive(metadata?.pid)) {
      await rm(this.paths.lock, { force: true });
      return true;
    }
    return false;
  }
}
