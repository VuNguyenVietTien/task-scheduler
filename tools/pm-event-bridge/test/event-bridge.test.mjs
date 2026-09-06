import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';

import { DurableQueue, ConsumerLockError } from '../lib/durable-queue.mjs';
import { EventBridge } from '../lib/event-bridge.mjs';
import { HerdrSocketClient } from '../lib/herdr-socket.mjs';
import { readJson, readJsonl } from '../lib/io.mjs';
import { SequentialConsumer } from '../lib/sequential-consumer.mjs';
import { CodexWakeAdapter } from '../lib/wake-adapter.mjs';

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pm-event-bridge-'));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  return directory;
}

async function eventually(check, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError ?? new Error('Timed out waiting for condition');
}

function workerPane({ status = 'working', sequence = 1, paneId = 'w-test:p1' } = {}) {
  return {
    pane_id: paneId,
    workspace_id: 'w-test',
    agent: 'pi',
    name: 'pm-worker-a',
    title: 'pm-owned test worker',
    agent_status: status,
    state_change_seq: sequence,
  };
}

function snapshot(panes) {
  return { agents: panes, panes, protocol: 20 };
}

class FakeHerdrServer {
  constructor(initialSnapshot) {
    this.currentSnapshot = initialSnapshot;
    this.clients = new Set();
    this.subscriptionCalls = [];
    this.connectionCount = 0;
  }

  async start(directory) {
    this.socketPath = path.join(directory, 'herdr.sock');
    this.server = net.createServer((socket) => this.#attach(socket));
    this.server.listen(this.socketPath);
    await once(this.server, 'listening');
    return this.socketPath;
  }

  async stop() {
    for (const socket of this.clients) socket.destroy();
    if (this.server?.listening) {
      this.server.close();
      await once(this.server, 'close');
    }
  }

  setSnapshot(next) {
    this.currentSnapshot = next;
  }

  subscriptions() {
    return this.subscriptionCalls.flatMap((call) => call.subscriptions);
  }

  // Protocol-20 separates dotted request selectors from snake-case generic
  // push event discriminators/payload type fields. Tests must use this exact
  // envelope, not dotted selector names as faux push events.
  emitPush(event, data = {}) {
    const ALLOWED_PUSH_EVENTS = new Set([
      'pane_created',
      'pane_agent_detected',
      'pane_exited',
      'pane_agent_status_changed',
    ]);
    if (!ALLOWED_PUSH_EVENTS.has(event)) {
      throw new Error(`unsupported fake push discriminator: ${event}`);
    }
    const payload = { ...data, type: event };
    const line = `${JSON.stringify({ event, data: payload })}\n`;
    for (const socket of this.clients) {
      if (!socket.destroyed) socket.write(line);
    }
  }

  disconnectAll() {
    for (const socket of this.clients) socket.destroy();
  }

  #attach(socket) {
    this.connectionCount += 1;
    this.clients.add(socket);
    let buffer = '';
    socket.on('close', () => this.clients.delete(socket));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        const index = buffer.indexOf('\n');
        if (index < 0) return;
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const request = JSON.parse(line);
        this.#respond(socket, request);
      }
    });
  }

  // F1: strict protocol-20 surface — only the request methods and subscription
  // types verified by the source review. Everything else is rejected exactly as
  // a real 0.8.2 server would reject an unknown method/subscription type.
  #respond(socket, request) {
    const error = (code, message) => {
      socket.write(`${JSON.stringify({ id: request.id, error: { code, message } })}\n`);
    };
    if (request.method === 'session.snapshot') {
      socket.write(`${JSON.stringify({ id: request.id, result: { type: 'session_snapshot', snapshot: this.currentSnapshot } })}\n`);
      return;
    }
    if (request.method === 'events.subscribe') {
      const ALLOWED = new Set(['pane.created', 'pane.agent_detected', 'pane.exited', 'pane.agent_status_changed']);
      const subscriptions = request.params?.subscriptions ?? [];
      const invalid = subscriptions.filter((item) => !ALLOWED.has(item.type)
        || (item.type === 'pane.agent_status_changed' && typeof item.pane_id !== 'string'));
      if (invalid.length) {
        error('invalid_request', `unsupported subscription: ${JSON.stringify(invalid[0])}`);
        return;
      }
      this.subscriptionCalls.push({ socket, subscriptions });
      socket.write(`${JSON.stringify({ id: request.id, result: { type: 'subscription_started' } })}\n`);
      return;
    }
    error('method_not_found', `unknown method: ${request.method}`);
  }
}

function baseConfig(directory, herdrSocket, overrides = {}) {
  return {
    herdrSocket,
    queueDir: path.join(directory, 'state'),
    managerThreadId: 'bridge-test-thread',
    codexBin: '/definitely/not/a/real/codex',
    codexPrefixArgs: [],
    dryRun: true,
    watchPrefix: 'pm-',
    maxAttempts: 3,
    retryBaseMs: 5,
    retryMaxMs: 10,
    reconnectBaseMs: 5,
    reconnectMaxMs: 20,
    maxBatchEvents: 100,
    ...overrides,
  };
}

function queuedEvent(index) {
  return {
    paneId: `w-test:p${index}`,
    workspaceId: 'w-test',
    agentKind: 'pi',
    agentName: `pm-worker-${index}`,
    previousStatus: 'working',
    status: 'done',
    transition: index,
    source: 'test',
    dedupeKey: `test:${index}`,
  };
}

async function writeFakeCodex(directory) {
  const script = path.join(directory, 'fake-codex.mjs');
  await writeFile(script, `
import { readFile, writeFile } from 'node:fs/promises';
const statePath = process.env.FAKE_CODEX_STATE;
const delay = Number(process.env.FAKE_CODEX_DELAY_MS || 0);
const failUntil = Number(process.env.FAKE_CODEX_FAIL_UNTIL || 0);
const mode = process.env.FAKE_CODEX_MODE || '';
const hangUntil = Number(process.env.FAKE_CODEX_HANG_UNTIL || 0);
async function readState() {
  try { return JSON.parse(await readFile(statePath, 'utf8')); } catch { return { calls: 0, active: 0, maxActive: 0, invocations: [] }; }
}
async function save(state) { await writeFile(statePath, JSON.stringify(state)); }
const state = await readState();
state.calls += 1;
state.active += 1;
state.maxActive = Math.max(state.maxActive, state.active);
state.invocations.push({ phase: 'start', call: state.calls, args: process.argv.slice(2), at: Date.now() });
await save(state);
if (mode === 'hang' && state.calls <= hangUntil) {
  // F5: never exits by itself; the bridge must TERM/KILL it.
  setInterval(() => {}, 10_000);
} else {
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const outputIndex = process.argv.indexOf('-o');
  if (outputIndex >= 0) await writeFile(process.argv[outputIndex + 1], 'fake Codex last message');
  const finished = await readState();
  finished.active -= 1;
  finished.invocations.push({ phase: 'end', call: state.calls, at: Date.now() });
  await save(finished);
  process.exit(state.calls <= failUntil ? 7 : 0);
}
`, 'utf8');
  await chmod(script, 0o700);
  return script;
}

async function fakeState(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

test('captures only working-to-settled push events and persists a durable queue record', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane()]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();

  await eventually(() => {
    assert.ok(server.subscriptions().some((item) => item.type === 'pane.agent_status_changed' && item.pane_id === 'w-test:p1'));
  });

  server.emitPush('pane_agent_status_changed', workerPane({ status: 'done', sequence: 2 }));
  await eventually(async () => {
    const records = await readJsonl(path.join(directory, 'state', 'queue.jsonl'));
    assert.equal(records.length, 1);
    assert.equal(records[0].previousStatus, 'working');
    assert.equal(records[0].status, 'done');
    // F7: default dry-run advances the simulation cursor, not the live one.
    const status = await bridge.queue.status();
    assert.equal(status.simCursor, 1);
    assert.equal(status.cursor, 0);
  });

  // Duplicate settled and non-meaningful churn must not create more wake records.
  server.emitPush('pane_agent_status_changed', workerPane({ status: 'done', sequence: 2 }));
  server.emitPush('pane_agent_status_changed', workerPane({ status: 'working', sequence: 3 }));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal((await readJsonl(path.join(directory, 'state', 'queue.jsonl'))).length, 1);
  await bridge.stop();
});

test('coalesces a burst in ID order and never overlaps fake Codex wakes', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  await queue.enqueue(queuedEvent(1));
  await queue.enqueue(queuedEvent(2));
  await queue.enqueue(queuedEvent(3));

  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath, FAKE_CODEX_DELAY_MS: '80' },
  });
  const consumer = new SequentialConsumer(queue, new CodexWakeAdapter(config), {
    maxAttempts: 1,
    maxBatchEvents: 100,
    retryBaseMs: 1,
    retryMaxMs: 1,
  });
  const draining = consumer.drain();
  await eventually(async () => {
    const state = await fakeState(statePath);
    assert.equal(state.calls, 1);
    assert.equal(state.active, 1);
  });
  await queue.enqueue(queuedEvent(4));
  await draining;

  const state = await fakeState(statePath);
  const starts = state.invocations.filter((event) => event.phase === 'start');
  assert.equal(starts.length, 2);
  assert.equal(state.maxActive, 1);
  const firstDigest = starts[0].args[starts[0].args.indexOf('bridge-test-thread') + 1];
  const secondDigest = starts[1].args[starts[1].args.indexOf('bridge-test-thread') + 1];
  assert.match(firstDigest, /event_id=1[\s\S]*event_id=2[\s\S]*event_id=3/);
  assert.match(secondDigest, /event_id=4/);
  assert.equal((await queue.status()).cursor, 4);
});

test('retries, dead-letters an exhausted batch, then continues with the next event', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  await queue.enqueue(queuedEvent(1));
  await queue.enqueue(queuedEvent(2));

  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath, FAKE_CODEX_FAIL_UNTIL: '2' },
  });
  const consumer = new SequentialConsumer(queue, new CodexWakeAdapter(config), {
    maxAttempts: 2,
    maxBatchEvents: 1,
    retryBaseMs: 1,
    retryMaxMs: 1,
  });
  await consumer.drain();

  const deadLetters = await readJsonl(path.join(directory, 'state', 'dead-letter.jsonl'));
  assert.equal(deadLetters.length, 1);
  assert.deepEqual(deadLetters[0].eventIds, [1]);
  assert.equal((await fakeState(statePath)).calls, 3);
  assert.equal((await queue.status()).cursor, 2);
});

test('reconnects, re-subscribes, and reconciles a settled snapshot after disconnect', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane({ status: 'working', sequence: 1 })]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath, {
    reconnectBaseMs: 5,
    reconnectMaxMs: 10,
  }));
  t.after(() => bridge.stop());
  await bridge.start();
  const firstConnections = server.connectionCount;

  server.setSnapshot(snapshot([workerPane({ status: 'done', sequence: 2 })]));
  server.disconnectAll();
  await eventually(async () => {
    assert.ok(server.connectionCount > firstConnections);
    const records = await readJsonl(path.join(directory, 'state', 'queue.jsonl'));
    assert.equal(records.length, 1);
    assert.equal(records[0].previousStatus, 'working');
    assert.equal(records[0].status, 'done');
    // The first snapshot of the new connection performs the reconciliation.
    assert.ok(['snapshot_seed', 'snapshot_reconcile'].includes(records[0].source));
    // F7: reconciliation in default dry-run mode advances the simulation cursor.
    const status = await bridge.queue.status();
    assert.equal(status.simCursor, 1);
    assert.equal(status.cursor, 0);
    assert.ok(server.subscriptionCalls.length >= 2, 'each reconnect re-subscribes');
  });
  await bridge.stop();
});

test('dry run does not execute a fake Codex command', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: true,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath },
  });
  const result = await new CodexWakeAdapter(config).wake([{ id: 1, ...queuedEvent(1) }]);
  assert.equal(result.dryRun, true);
  await assert.rejects(readFile(statePath, 'utf8'), { code: 'ENOENT' });
});

test('recovers a working-to-settled change that happened while the process was down from durable pane state', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane({ status: 'done', sequence: 9 })]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);

  // Simulate a previous run that durably recorded the pane as working.
  const priorQueue = new DurableQueue(path.join(directory, 'state'));
  await priorQueue.init();
  await priorQueue.setPaneState('w-test:p1', { status: 'working', transition: 3 });

  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();

  await eventually(async () => {
    const records = await readJsonl(path.join(directory, 'state', 'queue.jsonl'));
    assert.equal(records.length, 1);
    assert.equal(records[0].previousStatus, 'working');
    assert.equal(records[0].status, 'done');
    assert.equal(records[0].source, 'snapshot_seed');
  });
  await bridge.stop();
});

test('dedupe survives the checkpoint and only one consumer can hold the lock', async (t) => {
  const directory = await temporaryDirectory(t);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  const first = await queue.enqueue(queuedEvent(1));
  const duplicate = await queue.enqueue(queuedEvent(1));
  assert.equal(first.enqueued, true);
  assert.equal(duplicate.enqueued, false);
  assert.equal((await readJsonl(path.join(directory, 'state', 'queue.jsonl'))).length, 1);

  const secondInstance = new DurableQueue(path.join(directory, 'state'));
  await secondInstance.init();
  const lock = await queue.acquireConsumerLock();
  await assert.rejects(secondInstance.acquireConsumerLock(), ConsumerLockError);
  await lock.release();
  const secondLock = await secondInstance.acquireConsumerLock();
  await secondLock.release();
});

test('F1: fake Herdr enforces the verified protocol surface and rejects invented ones', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane()]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);

  const client = new HerdrSocketClient(socketPath);
  await client.connect();
  await assert.rejects(
    client.request('events.subscribe', { subscriptions: [{ type: 'pane.updated' }] }),
    /unsupported subscription/,
  );
  await assert.rejects(
    client.request('events.subscribe', { subscriptions: [{ type: 'pane.agent_status_changed' }] }),
    /unsupported subscription/,
  );
  await assert.rejects(client.request('pane.get', { pane_id: 'w-test:p1' }), /unknown method/);
  await client.request('events.subscribe', { subscriptions: [{ type: 'pane.agent_status_changed', pane_id: 'w-test:p1' }] });
  client.close();

  // The bridge itself must only ever send the verified subscription set.
  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();
  await eventually(() => assert.ok(server.subscriptionCalls.length >= 1));
  const bridgeCall = server.subscriptionCalls.at(-1);
  const types = new Set(bridgeCall.subscriptions.map((item) => item.type));
  assert.deepEqual([...types].sort(), ['pane.agent_detected', 'pane.agent_status_changed', 'pane.created', 'pane.exited']);
  await bridge.stop();
});

test('F2: a torn final queue append is quarantined and truncated, then replay appends cleanly', async (t) => {
  const directory = await temporaryDirectory(t);
  const stateDir = path.join(directory, 'state');
  await mkdir(stateDir, { recursive: true });
  const queueFile = path.join(stateDir, 'queue.jsonl');

  // One good fsynced record plus a crash-torn partial record without newline.
  await writeFile(queueFile, `${JSON.stringify({ id: 1, dedupeKey: 'seed:1', paneId: 'w-test:p1' })}\n{"id":2,"tor`);
  const tornFiles = (await readdir(stateDir)).filter((name) => name.startsWith('queue.jsonl.torn-'));
  assert.equal(tornFiles.length, 0);

  const queue = new DurableQueue(stateDir);
  const result = await queue.enqueue(queuedEvent(2));
  assert.equal(result.enqueued, true);
  assert.equal(result.id, 2, 'torn record must not consume an id');

  const repaired = (await readdir(stateDir)).filter((name) => name.startsWith('queue.jsonl.torn-'));
  assert.equal(repaired.length, 1, 'torn bytes quarantined durably');
  const content = await readFile(queueFile, 'utf8');
  assert.ok(content.endsWith('\n'), 'file ends with a record separator');
  const lines = content.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => JSON.parse(line).id), [1, 2], 'both records parse standalone');
});

test('F2: a complete but unterminated final record gets a separator, not truncation', async (t) => {
  const directory = await temporaryDirectory(t);
  const stateDir = path.join(directory, 'state');
  await mkdir(stateDir, { recursive: true });
  const queueFile = path.join(stateDir, 'queue.jsonl');
  const record = { id: 7, dedupeKey: 'seed:7', paneId: 'w-test:p1' };
  await writeFile(queueFile, JSON.stringify(record));

  const queue = new DurableQueue(stateDir);
  await queue.init();
  const content = await readFile(queueFile, 'utf8');
  assert.ok(content.endsWith('\n'), 'separator appended');
  assert.deepEqual((await readJsonl(queueFile)).map((item) => item.id), [7]);
});

test('F3: a second bridge instance cannot start; one process drains with exactly one wake', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  await queue.acquireInstanceLock();
  // Explicit release prevents a test-created FileHandle from surviving to GC.
  t.after(() => queue.releaseInstanceLock());

  const second = new DurableQueue(path.join(directory, 'state'));
  // F3.2: even initialization (repair/checkpoint persist) cannot mutate while
  // another lifetime instance lock is held.
  await assert.rejects(second.init(), ConsumerLockError);
  await assert.rejects(second.acquireInstanceLock(), ConsumerLockError);

  await queue.enqueue(queuedEvent(1));
  await queue.enqueue(queuedEvent(2));
  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath },
  });
  const consumer = new SequentialConsumer(queue, new CodexWakeAdapter(config), { maxAttempts: 1 });
  await consumer.drain();

  const state = await fakeState(statePath);
  assert.equal(state.calls, 1, 'exactly one wake across both instances');
  const digest = state.invocations[0].args[state.invocations[0].args.indexOf('bridge-test-thread') + 1];
  assert.match(digest, /event_id=1[\s\S]*event_id=2/);
  assert.equal((await queue.status()).cursor, 2);
});

test('F4: dead-lettered-but-uncursored events are recovered at init without any wake', async (t) => {
  const directory = await temporaryDirectory(t);
  const stateDir = path.join(directory, 'state');
  await mkdir(stateDir, { recursive: true });
  // Crash state: dead-letter fsynced, cursor advance never happened.
  await writeFile(path.join(stateDir, 'queue.jsonl'), `${JSON.stringify({ id: 1, ...queuedEvent(1) })}\n`);
  await writeFile(path.join(stateDir, 'dead-letter.jsonl'), `${JSON.stringify({ eventIds: [1], batchKey: 'live:events:1-1' })}\n`);
  await writeFile(path.join(stateDir, 'checkpoint.json'), JSON.stringify({ version: 1, nextId: 2, cursor: 0, simCursor: 0, panes: {}, dedupe: {}, retries: {} }));

  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(stateDir);
  await queue.init();
  const status = await queue.status();
  assert.equal(status.cursor, 1, 'cursor atomically advanced past dead-lettered event');
  assert.equal(status.pendingEvents, 0);

  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath },
  });
  await new SequentialConsumer(queue, new CodexWakeAdapter(config)).drain();
  await assert.rejects(fakeState(statePath), { code: 'ENOENT' }, 'no wake happened during recovery');
});

test('F5: a hung wake child is TERM/KILLed, dead-lettered, and the next event still drains', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  await queue.enqueue(queuedEvent(1));
  await queue.enqueue(queuedEvent(2));

  const config = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    wakeTimeoutMs: 250,
    killGraceMs: 150,
    commandEnv: { FAKE_CODEX_STATE: statePath, FAKE_CODEX_MODE: 'hang', FAKE_CODEX_HANG_UNTIL: '1' },
  });
  const consumer = new SequentialConsumer(queue, new CodexWakeAdapter(config), {
    maxAttempts: 1,
    maxBatchEvents: 1,
    retryBaseMs: 1,
    retryMaxMs: 1,
  });
  // Drain must terminate despite the forever-hanging first child.
  const timer = setTimeout(() => t.diagnostic('drain still running'), 10_000);
  timer.unref();
  await consumer.drain();

  const deadLetters = await readJsonl(path.join(directory, 'state', 'dead-letter.jsonl'));
  assert.equal(deadLetters.length, 1);
  assert.match(deadLetters[0].error, /timed out after 250ms/);
  const state = await fakeState(statePath);
  assert.equal(state.calls, 2, 'hung attempt then successful next event');
  assert.equal((await queue.status()).cursor, 2, 'continuation past the dead-lettered batch');
});

test('F6: panes that disappear while disconnected are pruned from watches and durable state', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane({ status: 'working', sequence: 1 })]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath, { reconnectBaseMs: 5, reconnectMaxMs: 10 }));
  t.after(() => bridge.stop());
  await bridge.start();
  await eventually(() => assert.ok(server.subscriptions().some((item) => item.pane_id === 'w-test:p1')));
  const checkpointPath = path.join(directory, 'state', 'checkpoint.json');
  await eventually(async () => {
    assert.ok('w-test:p1' in (await readJson(checkpointPath, {})).panes);
  });

  server.setSnapshot(snapshot([]));
  server.disconnectAll();
  await eventually(async () => {
    const lastCall = server.subscriptionCalls.at(-1);
    assert.ok(lastCall, 'reconnected');
    assert.ok(!lastCall.subscriptions.some((item) => item.pane_id === 'w-test:p1'), 'stale pane no longer subscribed');
    assert.deepEqual((await readJson(checkpointPath, {})).panes, {}, 'stale pane state pruned');
  });
});

test('F7: dry-run advances only the simulation cursor; later live wake delivers the same events', async (t) => {
  const directory = await temporaryDirectory(t);
  const statePath = path.join(directory, 'fake-state.json');
  const fakeCodex = await writeFakeCodex(directory);
  const queue = new DurableQueue(path.join(directory, 'state'));
  await queue.init();
  await queue.enqueue(queuedEvent(1));

  const dryConfig = baseConfig(directory, path.join(directory, 'unused.sock'), { dryRun: true });
  await new SequentialConsumer(queue, new CodexWakeAdapter(dryConfig)).drain();
  let status = await queue.status();
  assert.equal(status.cursor, 0, 'live cursor untouched by dry-run');
  assert.equal(status.simCursor, 1);

  const liveConfig = baseConfig(directory, path.join(directory, 'unused.sock'), {
    dryRun: false,
    codexBin: process.execPath,
    codexPrefixArgs: [fakeCodex],
    commandEnv: { FAKE_CODEX_STATE: statePath },
  });
  await new SequentialConsumer(queue, new CodexWakeAdapter(liveConfig), { maxAttempts: 1 }).drain();
  status = await queue.status();
  assert.equal(status.cursor, 1, 'live wake delivered the dry-run-captured event');
  assert.equal((await fakeState(statePath)).calls, 1);
});

test('F7: CLI enforces the live double gate end to end', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([workerPane({ status: 'working', sequence: 1 })]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const configPath = path.join(directory, 'config.json');
  // Config says live, but the --enable-live-wake flag is absent: must be dry-run.
  await writeFile(configPath, JSON.stringify({
    herdrSocket: socketPath,
    queueDir: path.join(directory, 'state'),
    managerThreadId: 'bridge-test-thread',
    codexBin: process.execPath,
    codexPrefixArgs: [await writeFakeCodex(directory)],
    commandEnv: { FAKE_CODEX_STATE: path.join(directory, 'fake-state.json') },
    dryRun: false,
  }));

  const toolDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const child = spawn(process.execPath, [path.join(toolDir, 'pm-event-bridge.mjs'), 'run', '--config', configPath], {
    cwd: toolDir,
  });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  await eventually(() => assert.match(stdout, /"dryRun":true/), 5_000);
  server.emitPush('pane_agent_status_changed', workerPane({ status: 'done', sequence: 2 }));
  await eventually(async () => {
    assert.equal((await readJsonl(path.join(directory, 'state', 'queue.jsonl'))).length, 1);
  }, 5_000);
  child.kill('SIGTERM');
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
  const status = JSON.parse(await readFile(path.join(directory, 'state', 'checkpoint.json'), 'utf8'));
  assert.equal(status.cursor, 0, 'CLI dry-run never advances the live cursor');
  assert.equal(status.simCursor, 1);
});

test('F1: schema-faithful pane_created push resolves snapshot identity and subscribes the new pane', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();

  const created = workerPane({ paneId: 'w-test:p-created', status: 'working', sequence: 1 });
  server.setSnapshot(snapshot([created]));
  server.emitPush('pane_created', { pane: { pane_id: created.pane_id, workspace_id: created.workspace_id } });

  await eventually(async () => {
    assert.ok(server.subscriptions().some((item) => item.type === 'pane.agent_status_changed' && item.pane_id === created.pane_id));
    assert.equal((await bridge.queue.status()).trackedPanes, 1);
  });
});

test('F1: schema-faithful pane_agent_detected push resolves and watches a pm pane', async (t) => {
  const directory = await temporaryDirectory(t);
  const server = new FakeHerdrServer(snapshot([]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();

  const detected = workerPane({ paneId: 'w-test:p-detected', status: 'working', sequence: 1 });
  server.setSnapshot(snapshot([detected]));
  server.emitPush('pane_agent_detected', { pane_id: detected.pane_id, workspace_id: detected.workspace_id });

  await eventually(() => {
    assert.ok(server.subscriptions().some((item) => item.type === 'pane.agent_status_changed' && item.pane_id === detected.pane_id));
  });
});

test('F1: schema-faithful pane_exited push immediately removes watch and durable pane state', async (t) => {
  const directory = await temporaryDirectory(t);
  const exited = workerPane({ paneId: 'w-test:p-exited', status: 'working', sequence: 1 });
  const server = new FakeHerdrServer(snapshot([exited]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);
  const bridge = new EventBridge(baseConfig(directory, socketPath));
  t.after(() => bridge.stop());
  await bridge.start();
  await eventually(async () => {
    assert.ok('w-test:p-exited' in (await readJson(path.join(directory, 'state', 'checkpoint.json'), {})).panes);
  });

  server.emitPush('pane_exited', { pane_id: exited.pane_id, workspace_id: exited.workspace_id });
  await eventually(async () => {
    const checkpoint = await readJson(path.join(directory, 'state', 'checkpoint.json'), {});
    assert.ok(!(exited.pane_id in checkpoint.panes));
  });
});

test('F3: stop holds lifetime lock through an in-flight wake; replacement cannot overlap or duplicate', async (t) => {
  const directory = await temporaryDirectory(t);
  const pane = workerPane({ status: 'working', sequence: 1 });
  const server = new FakeHerdrServer(snapshot([pane]));
  t.after(() => server.stop());
  const socketPath = await server.start(directory);

  let unblockWake;
  const wakeStarted = new Promise((resolve) => { unblockWake = resolve; });
  let releaseWake;
  const wakeGate = new Promise((resolve) => { releaseWake = resolve; });
  let firstWakeCalls = 0;
  const blockingAdapter = {
    isDryRun: () => false,
    wake: async () => {
      firstWakeCalls += 1;
      unblockWake();
      await wakeGate;
      return { dryRun: false };
    },
  };
  const bridgeOne = new EventBridge(baseConfig(directory, socketPath, { dryRun: false }), { wakeAdapter: blockingAdapter });
  t.after(() => bridgeOne.stop());
  await bridgeOne.start();
  server.emitPush('pane_agent_status_changed', workerPane({ status: 'done', sequence: 2 }));
  await wakeStarted;

  const stopping = bridgeOne.stop();
  const replacementCalls = [];
  const replacementAdapter = {
    isDryRun: () => false,
    wake: async (events) => { replacementCalls.push(events.map((event) => event.id)); return { dryRun: false }; },
  };
  const bridgeTwo = new EventBridge(baseConfig(directory, socketPath, { dryRun: false }), { wakeAdapter: replacementAdapter });
  t.after(() => bridgeTwo.stop());

  await assert.rejects(bridgeTwo.start(), ConsumerLockError, 'replacement remains locked out while wake is in flight');
  assert.equal(firstWakeCalls, 1);
  assert.equal(replacementCalls.length, 0);
  const duringStop = await readJson(path.join(directory, 'state', 'checkpoint.json'), {});
  assert.equal(duringStop.cursor, 0, 'cursor is not advanced before the blocked wake settles');

  releaseWake();
  await stopping;
  await bridgeTwo.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(replacementCalls.length, 0, 'settled cursor prevents a replacement duplicate wake');
  assert.equal((await bridgeTwo.queue.status()).cursor, 1);
  await bridgeTwo.stop();
});
