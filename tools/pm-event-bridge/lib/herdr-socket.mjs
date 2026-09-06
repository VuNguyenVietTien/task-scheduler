import { EventEmitter } from 'node:events';
import net from 'node:net';

export class HerdrSocketClient extends EventEmitter {
  constructor(socketPath, { requestTimeoutMs = 10_000, logger = () => {} } = {}) {
    super();
    this.socketPath = socketPath;
    this.requestTimeoutMs = requestTimeoutMs;
    this.logger = logger;
    this.socket = undefined;
    this.buffer = '';
    this.sequence = 0;
    this.pending = new Map();
    this.disconnectPromise = undefined;
    this.resolveDisconnect = undefined;
    this.disconnected = false;
  }

  async connect() {
    if (this.socket) return this;
    this.disconnected = false;
    this.disconnectPromise = new Promise((resolve) => { this.resolveDisconnect = resolve; });

    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: this.socketPath });
      this.socket = socket;
      let connected = false;
      const failConnect = (error) => {
        if (!connected) reject(error);
      };
      socket.once('connect', () => {
        connected = true;
        resolve();
      });
      socket.once('error', failConnect);
      socket.on('data', (chunk) => this.#onData(chunk));
      socket.on('error', (error) => this.#disconnect(error));
      socket.on('close', () => this.#disconnect());
    });
    return this;
  }

  async request(method, params = {}) {
    if (!this.socket || this.disconnected || this.socket.destroyed) {
      throw new Error(`Herdr socket is not connected for ${method}`);
    }
    const id = `pm-event-bridge:${process.pid}:${++this.sequence}`;
    const request = `${JSON.stringify({ id, method, params })}\n`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Herdr request timed out: ${method}`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.socket.write(request, (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  waitForDisconnect() {
    return this.disconnectPromise ?? Promise.resolve();
  }

  close() {
    this.socket?.destroy();
    this.#disconnect();
  }

  #onData(chunk) {
    this.buffer += chunk.toString('utf8');
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        this.logger('invalid_socket_json', { line: line.slice(0, 500), error: error.message });
        continue;
      }
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code ?? 'error'}: ${message.error.message ?? 'Herdr error'}`));
        else pending.resolve(message.result);
        continue;
      }
      // Protocol-20 push envelopes normally include a snake-case `event`,
      // with the same discriminator in data.type. Accept either discriminator
      // position without conflating it with dotted subscription selectors.
      if (message.event || message.type?.startsWith('pane.') || message.data?.type?.startsWith('pane_')) {
        this.emit('event', message);
      } else {
        this.logger('unhandled_socket_message', message);
      }
    }
  }

  #disconnect(error) {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error ?? new Error(`Herdr socket disconnected during ${pending.method}`));
      this.pending.delete(id);
    }
    this.resolveDisconnect?.(error);
    this.emit('disconnect', error);
  }
}
