import { boundedBackoff, sleep as defaultSleep } from './io.mjs';

export class SequentialConsumer {
  constructor(queue, wakeAdapter, {
    maxAttempts = 3,
    retryBaseMs = 1_000,
    retryMaxMs = 30_000,
    maxBatchEvents = 100,
    sleep = defaultSleep,
    onEvent = () => {},
  } = {}) {
    this.queue = queue;
    this.wakeAdapter = wakeAdapter;
    this.maxAttempts = Math.max(1, maxAttempts);
    this.retryBaseMs = Math.max(0, retryBaseMs);
    this.retryMaxMs = Math.max(this.retryBaseMs, retryMaxMs);
    this.maxBatchEvents = Math.max(1, maxBatchEvents);
    this.sleep = sleep;
    this.onEvent = onEvent;
    this.inFlight = undefined;
  }

  drain() {
    if (!this.inFlight) {
      this.inFlight = this.#drain().finally(() => { this.inFlight = undefined; });
    }
    return this.inFlight;
  }

  async #drain() {
    // F3: when the bridge holds the process-lifetime instance lock, reuse it;
    // otherwise fall back to a per-drain lock (standalone consumer usage).
    const ownsDrainLock = !this.queue.instanceLock;
    const lock = this.queue.instanceLock ?? await this.queue.acquireConsumerLock();
    try {
      // F7: dry-run plans advance a simulation cursor only; the live cursor
      // stays behind so enabling live wake later delivers every captured event.
      const simulated = this.wakeAdapter.isDryRun?.() ?? false;
      const fetchPending = () => (simulated
        ? this.queue.pendingSimulated(this.maxBatchEvents)
        : this.queue.pending(this.maxBatchEvents));
      for (;;) {
        // Taking one immutable prefix is the coalescing boundary. Events that
        // arrive during its wake remain in queue order for the next wake.
        const batch = await fetchPending();
        if (!batch.length) return;
        const batchKey = `${simulated ? 'sim' : 'live'}:events:${batch[0].id}-${batch.at(-1).id}`;
        let attempts = this.queue.retryCount(batchKey);

        for (;;) {
          attempts += 1;
          try {
            this.onEvent({ type: 'wake_attempt', batchKey, attempts, eventIds: batch.map((event) => event.id) });
            const result = await this.wakeAdapter.wake(batch);
            await this.queue.complete(batch, batchKey, { simulated });
            this.onEvent({ type: 'wake_complete', batchKey, attempts, result });
            break;
          } catch (error) {
            await this.queue.recordRetry(batchKey, attempts, error);
            this.onEvent({ type: 'wake_failed', batchKey, attempts, error: String(error.message ?? error) });
            if (attempts >= this.maxAttempts) {
              await this.queue.deadLetter(batch, batchKey, error, { simulated });
              this.onEvent({ type: 'dead_lettered', batchKey, attempts, eventIds: batch.map((event) => event.id) });
              break;
            }
            await this.sleep(boundedBackoff(this.retryBaseMs, this.retryMaxMs, attempts));
          }
        }
      }
    } finally {
      if (ownsDrainLock) await lock.release();
    }
  }
}
