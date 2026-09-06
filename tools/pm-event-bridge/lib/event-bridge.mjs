import { EventEmitter } from 'node:events';
import { DurableQueue } from './durable-queue.mjs';
import { HerdrSocketClient } from './herdr-socket.mjs';
import { boundedBackoff, sleep as defaultSleep } from './io.mjs';
import { SequentialConsumer } from './sequential-consumer.mjs';
import { CodexWakeAdapter } from './wake-adapter.mjs';

const SETTLED_STATUSES = new Set(['idle', 'done', 'blocked']);
const KNOWN_STATUSES = new Set(['idle', 'working', 'blocked', 'done', 'unknown']);
// F1: only Herdr 0.8.2 protocol-20 lifecycle subscriptions verified by the
// source review (plans/reports/herdr-260831-0100-event-bridge-sol-review.md §2.1).
const LIFECYCLE_SUBSCRIPTIONS = [
  { type: 'pane.created' },
  { type: 'pane.agent_detected' },
  { type: 'pane.exited' },
];

function unwrapSnapshot(result) {
  return result?.snapshot ?? result?.result?.snapshot ?? result;
}

function unwrapPane(result) {
  return result?.pane ?? result?.result?.pane ?? result;
}

// Protocol-20 deliberately has two naming surfaces: subscriptions are dotted
// selectors (pane.created), while pushed generic event discriminators/payload
// types are snake-case (pane_created). Keep that distinction explicit.
function eventType(message) {
  const raw = message.event ?? message.data?.type ?? message.type ?? '';
  return ({
    'pane.agent_status_changed': 'pane_agent_status_changed',
    'pane.created': 'pane_created',
    'pane.agent_detected': 'pane_agent_detected',
    'pane.exited': 'pane_exited',
  })[raw] ?? raw;
}

function eventData(message) {
  return message.data ?? message;
}

function asStatus(value) {
  return KNOWN_STATUSES.has(value) ? value : undefined;
}

function paneIdOf(pane) {
  return pane?.pane_id ?? pane?.paneId;
}

function agentNameOf(pane) {
  return pane?.name ?? pane?.agent_name ?? pane?.agentName;
}

function titleOf(pane) {
  return pane?.title ?? pane?.terminal_title ?? pane?.terminalTitle;
}

export function isPmOwnedPane(pane, config) {
  if (!pane || (config.workspaceId && pane.workspace_id && pane.workspace_id !== config.workspaceId)) return false;
  const title = titleOf(pane);
  const name = agentNameOf(pane);
  const watchPrefix = config.watchPrefix ?? 'pm-';
  return (typeof title === 'string' && title.toLowerCase().startsWith('pm-owned'))
    || (typeof name === 'string' && name.startsWith(watchPrefix));
}

export class EventBridge extends EventEmitter {
  constructor(config, {
    logger = () => {},
    clientFactory = (socketPath) => new HerdrSocketClient(socketPath, { logger }),
    queue = new DurableQueue(config.queueDir),
    wakeAdapter = new CodexWakeAdapter(config),
    sleep = defaultSleep,
  } = {}) {
    super();
    this.config = config;
    this.logger = logger;
    this.clientFactory = clientFactory;
    this.queue = queue;
    this.wakeAdapter = wakeAdapter;
    this.sleep = sleep;
    this.consumer = new SequentialConsumer(queue, wakeAdapter, {
      maxAttempts: config.maxAttempts,
      retryBaseMs: config.retryBaseMs,
      retryMaxMs: config.retryMaxMs,
      maxBatchEvents: config.maxBatchEvents,
      sleep,
      onEvent: (event) => this.emit('consumer', event),
    });
    this.client = undefined;
    this.watched = new Set();
    this.running = false;
    this.loopPromise = undefined;
    this.stopWaiters = [];
    this.captureTail = Promise.resolve();
    this.initialReady = undefined;
    this.resolveInitialReady = undefined;
  }

  async start() {
    if (this.loopPromise) return this.initialReady;
    // F3: one bridge process per queue directory, for the whole process life.
    await this.queue.acquireInstanceLock();
    this.running = true;
    this.initialReady = new Promise((resolve) => { this.resolveInitialReady = resolve; });
    this.loopPromise = this.#connectionLoop();
    // Existing durable work is safe to drain immediately; no Herdr polling is used.
    this.#drainSoon();
    return this.initialReady;
  }

  async stop() {
    if (!this.loopPromise) return;
    this.running = false;
    if (this.resolveInitialReady) {
      this.resolveInitialReady();
      this.resolveInitialReady = undefined;
    }
    for (const resolve of this.stopWaiters.splice(0)) resolve();
    this.client?.close();
    await this.loopPromise;
    this.loopPromise = undefined;
    this.client = undefined;

    // F3.1: the lifetime lock remains held through all serialized capture and
    // the current drain/wake. A replacement bridge cannot observe an old
    // cursor and overlap an in-flight wake during shutdown.
    await this.captureTail;
    const activeConsumer = this.consumer.inFlight;
    if (activeConsumer) {
      try {
        await activeConsumer;
      } catch (error) {
        // #drainSoon has already logged the failure; the retained queue state
        // is safe for a later replacement, but never release mid-wake.
        this.#log('consumer_shutdown_failed', { error: error.message });
      }
    }
    await this.queue.releaseInstanceLock();
  }

  async #connectionLoop() {
    let failures = 0;
    while (this.running) {
      let client;
      try {
        client = this.clientFactory(this.config.herdrSocket);
        this.client = client;
        client.on('event', (message) => {
          // Socket data can contain a burst in one turn. Serialize capture and
          // checkpoint writes before handing queued work to the consumer.
          this.captureTail = this.captureTail
            .then(() => this.#handleSocketEvent(message))
            .catch((error) => this.#log('event_handler_failed', { error: error.message }));
        });
        await client.connect();
        await this.#seedSubscribeAndReconcile(client);
        failures = 0;
        if (this.resolveInitialReady) {
          this.resolveInitialReady();
          this.resolveInitialReady = undefined;
        }
        this.emit('connected');
        await client.waitForDisconnect();
      } catch (error) {
        this.#log('socket_connection_failed', { error: error.message });
      }

      if (!this.running) break;
      failures += 1;
      const delay = boundedBackoff(
        this.config.reconnectBaseMs,
        this.config.reconnectMaxMs,
        failures,
      );
      this.emit('reconnecting', { attempt: failures, delay });
      await this.#waitOrStop(delay);
    }
  }

  async #seedSubscribeAndReconcile(client) {
    // First snapshot seeds unknown panes. The immediate second snapshot closes
    // the snapshot-to-subscription race without becoming periodic polling.
    const firstSnapshot = unwrapSnapshot(await client.request('session.snapshot', {}));
    await this.#applySnapshot(firstSnapshot, 'snapshot_seed');

    const subscriptions = [
      ...LIFECYCLE_SUBSCRIPTIONS,
      ...[...this.watched].map((paneId) => ({ type: 'pane.agent_status_changed', pane_id: paneId })),
    ];
    await client.request('events.subscribe', { subscriptions });

    const reconciliationSnapshot = unwrapSnapshot(await client.request('session.snapshot', {}));
    await this.#applySnapshot(reconciliationSnapshot, 'snapshot_reconcile', { subscribeNew: true });
  }

  async #applySnapshot(snapshot, source, { subscribeNew = false } = {}) {
    const panes = snapshot?.agents ?? snapshot?.panes ?? [];
    const seen = new Set();
    for (const pane of panes) {
      const paneId = paneIdOf(pane);
      if (!paneId || seen.has(paneId) || !isPmOwnedPane(pane, this.config)) continue;
      seen.add(paneId);
      await this.#watchPane(paneId, subscribeNew);
      await this.#observePane(pane, source);
    }
    // F6: panes absent from a fresh snapshot exited while we were not watching;
    // drop their watches and durable state so the next subscribe request and
    // checkpoint reflect reality instead of stale ids.
    for (const paneId of [...this.watched]) {
      if (!seen.has(paneId)) {
        this.watched.delete(paneId);
        await this.queue.removePaneState(paneId);
      }
    }
    await this.queue.prunePaneStates(seen);
  }

  async #watchPane(paneId, subscribeNow = true) {
    if (this.watched.has(paneId)) return;
    this.watched.add(paneId);
    if (subscribeNow && this.client && this.client !== undefined) {
      await this.client.request('events.subscribe', {
        subscriptions: [{ type: 'pane.agent_status_changed', pane_id: paneId }],
      });
    }
  }

  async #observePane(pane, source) {
    const paneId = paneIdOf(pane);
    const status = asStatus(pane?.agent_status ?? pane?.agentStatus ?? pane?.status);
    if (!paneId || !status) return;

    const previous = this.queue.getPaneState(paneId);
    const previousStatus = previous?.status;
    const changed = previousStatus !== status;
    const transition = (previous?.transition ?? 0) + (changed ? 1 : 0);

    // A settled status is only meaningful on top of a durably known 'working'
    // state. A pane with no prior state is baselined, never completed, so a
    // fresh snapshot cannot invent a wake.
    if (previousStatus === 'working' && SETTLED_STATUSES.has(status)) {
      const stateChangeSequence = pane.state_change_seq ?? pane.stateChangeSeq;
      const dedupeKey = stateChangeSequence === undefined
        ? `${paneId}:${transition}:working:${status}`
        : `${paneId}:seq:${stateChangeSequence}:working:${status}`;
      const event = {
        paneId,
        workspaceId: pane.workspace_id ?? pane.workspaceId,
        agentKind: pane.agent ?? pane.agent_kind ?? pane.agentKind,
        agentName: agentNameOf(pane),
        title: titleOf(pane),
        previousStatus: 'working',
        status,
        transition,
        source,
        dedupeKey,
      };
      const queued = await this.queue.enqueue(event);
      if (queued.enqueued) {
        this.emit('captured', queued.record);
        this.#drainSoon();
      }
    }

    await this.queue.setPaneState(paneId, {
      status,
      transition,
      workspaceId: pane.workspace_id ?? pane.workspaceId,
      agentName: agentNameOf(pane),
      title: titleOf(pane),
    });
  }

  async #handleSocketEvent(message) {
    const type = eventType(message);
    const data = eventData(message);
    if (type === 'pane_agent_status_changed') {
      const paneId = paneIdOf(data);
      if (!paneId) return;
      if (!this.watched.has(paneId) && !isPmOwnedPane(data, this.config)) return;
      await this.#watchPane(paneId);
      await this.#observePane(data, 'push');
      return;
    }

    // F1: schema-faithful snake-case push discriminator for the dotted
    // pane.exited selector; no invented pane.closed/updated names.
    if (type === 'pane_exited') {
      const paneId = paneIdOf(data) ?? data?.pane_id;
      if (paneId) {
        this.watched.delete(paneId);
        await this.queue.removePaneState(paneId);
      }
      return;
    }

    if (!['pane_created', 'pane_agent_detected'].includes(type)) return;

    // F1: resolve identity through the verified snapshot surface, triggered by
    // the lifecycle push itself (event-driven catch-up, not periodic polling).
    // The same applySnapshot pass adds new pm panes and prunes gone ones (F6).
    try {
      const snapshot = unwrapSnapshot(await this.client.request('session.snapshot', {}));
      await this.#applySnapshot(snapshot, 'lifecycle', { subscribeNew: true });
    } catch (error) {
      this.#log('lifecycle_resolution_failed', { type, error: error.message });
    }
  }

  #drainSoon() {
    this.consumer.drain().catch((error) => {
      this.#log('consumer_failed', { error: error.message });
      this.emit('consumer_error', error);
    });
  }

  async #waitOrStop(milliseconds) {
    await Promise.race([
      this.sleep(milliseconds),
      new Promise((resolve) => this.stopWaiters.push(resolve)),
    ]);
  }

  #log(event, details) {
    this.logger(event, details);
    this.emit('log', { event, ...details });
  }
}
