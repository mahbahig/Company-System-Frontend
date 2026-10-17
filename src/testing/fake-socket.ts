import type { ManagerOptions, SocketOptions } from 'socket.io-client';

type Handler = (...args: unknown[]) => void;

/**
 * A stand-in for the Socket.IO client, driven by the test as "the server":
 * accept or refuse the connection, push events, close it, answer commands.
 * It records the options it was created with (path, transports, the auth
 * callback) and what the client sent.
 */
export class FakeSocket {
  connected = false;
  active = false;
  /** What the client's `auth` callback produced for the last connection attempt. */
  handshake: Record<string, unknown> | null = null;
  readonly sent: Array<{ event: string; payload: unknown }> = [];
  /** How the "server" answers each command (default: `{ ok: true }`). */
  readonly answers = new Map<string, (payload: unknown) => unknown>();
  private readonly handlers = new Map<string, Handler[]>();
  private anyHandlers: Handler[] = [];

  constructor(readonly options: Partial<ManagerOptions & SocketOptions>) {}

  on(event: string, handler: Handler): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  onAny(handler: Handler): this {
    this.anyHandlers.push(handler);
    return this;
  }

  offAny(): this {
    this.anyHandlers = [];
    return this;
  }

  removeAllListeners(): this {
    this.handlers.clear();
    return this;
  }

  /** Starts a connection attempt: the client's auth callback is asked for the handshake. */
  connect(): this {
    this.active = true;
    const auth = this.options.auth as ((send: (data: Record<string, unknown>) => void) => void) | undefined;
    auth?.((data) => (this.handshake = data));
    return this;
  }

  disconnect(): this {
    const was = this.connected;
    this.connected = false;
    this.active = false;
    if (was) this.fire('disconnect', 'io client disconnect');
    return this;
  }

  timeout(_ms: number) {
    return {
      emitWithAck: async (event: string, payload: unknown) => {
        this.sent.push({ event, payload });
        const answer = this.answers.get(event);
        return answer ? answer(payload) : { ok: true };
      },
    };
  }

  // ── the "server" ───────────────────────────────────────────────────────

  accept(): void {
    this.connected = true;
    this.fire('connect');
  }

  refuse(message: string, status: number): void {
    this.active = false;
    const error = Object.assign(new Error(message), { data: { message, status } });
    this.fire('connect_error', error);
  }

  push(event: string, data: unknown): void {
    for (const handler of this.anyHandlers) handler(event, data);
  }

  /** The server closes the connection (its token expired, a re-check failed …). */
  close(): void {
    this.connected = false;
    this.active = false;
    this.fire('disconnect', 'io server disconnect');
  }

  private fire(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

/** A socket factory for `SOCKET_FACTORY` that keeps every socket it made. */
export function fakeSocketFactory(): { factory: (options: Partial<ManagerOptions & SocketOptions>) => FakeSocket; sockets: FakeSocket[]; last: () => FakeSocket | undefined } {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    last: () => sockets.at(-1),
    factory: (options) => {
      const socket = new FakeSocket(options);
      sockets.push(socket);
      return socket;
    },
  };
}
