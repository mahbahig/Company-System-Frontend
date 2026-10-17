import { DOCUMENT } from '@angular/common';
import { DestroyRef, InjectionToken, Service, effect, inject, signal, untracked } from '@angular/core';
import { Subject, filter, firstValueFrom, map, type Observable } from 'rxjs';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

import { AuthService } from '../auth/auth.service';
import { sessionEndReasonFor } from '../auth/session-end';
import { SessionExpiry } from '../auth/session-expiry.service';
import { TokenStore } from '../auth/token-store.service';
import { MaintenanceService } from '../maintenance/maintenance.service';

/** Where the API's Socket.IO endpoint lives (same origin; the dev server proxies it). */
export const SOCKET_PATH = '/api/v1/socket.io';
/** A token this close to its expiry is refreshed before it is used to connect. */
const TOKEN_MARGIN_MS = 30_000;
/** Reconnect delays after the server closed the socket or refused it for a reason worth retrying. */
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** Creates the Socket.IO client (a test provides a fake). */
export type SocketFactory = (options: Partial<ManagerOptions & SocketOptions>) => Socket;
export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', { providedIn: 'root', factory: () => (options) => io(options) });

/** One realtime event from the API — already chosen for this user by the server. */
export interface RealtimeMessage {
  type: string;
  data: unknown;
}

/** A refused connection: the API's message key and status. */
type ConnectError = Error & { data?: { message?: string; status?: number } };

/**
 * The browser's one realtime connection — Socket.IO (WebSocket only), open
 * while someone is signed in, past any forced first step, the page shown and
 * Ecotech not in maintenance. ONE socket per tab, created here and nowhere
 * else; every server event goes to `events$` (each listener registered once,
 * on the socket, by this service — components subscribe to `on()` and
 * unsubscribe when destroyed, so nothing is ever received twice).
 *
 * Authentication: the access token (memory only) goes in the handshake
 * `auth` payload — never the URL — refreshed first when it is about to
 * expire. A refusal says why: a session the API ended signs the user out
 * with its reason (`SessionExpiry`, once), maintenance shows its screen, an
 * expired token is refreshed and the connection retried. When the server
 * closes the socket (its token expired, a re-check failed) it is opened
 * again — authenticating again — while still wanted; after `FORCE_LOGOUT`
 * the user is already signed out, so it is not.
 *
 * Realtime only informs: the API enforces every security decision whether
 * or not a browser hears of it.
 */
@Service()
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenStore);
  private readonly expiry = inject(SessionExpiry);
  private readonly maintenance = inject(MaintenanceService);
  private readonly document = inject(DOCUMENT);
  private readonly createSocket = inject(SOCKET_FACTORY);

  private readonly messages = new Subject<RealtimeMessage>();
  /** Every event the server sends this browser tab. */
  readonly events$ = this.messages.asObservable();
  /** The socket is connected and authenticated. */
  readonly connected = signal(false);
  /** Counts (re)connections — what was missed while disconnected is read again from the API when it changes. */
  readonly connections = signal(0);
  /** The page is shown — false while it is being unloaded or kept in the back/forward cache. */
  private readonly shown = signal(true);

  private socket: Socket | null = null;
  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const window = this.document.defaultView;
    const onPageHide = () => {
      this.shown.set(false);
      this.stop();
    };
    const onPageShow = () => this.shown.set(true);
    window?.addEventListener('pagehide', onPageHide);
    window?.addEventListener('pageshow', onPageShow);
    effect(() => {
      const wanted = this.wanted();
      untracked(() => (wanted ? this.start() : this.stop()));
    });
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('pagehide', onPageHide);
      window?.removeEventListener('pageshow', onPageShow);
      this.stop();
    });
  }

  /** The events of one type (their payloads). */
  on<T>(type: string): Observable<T> {
    return this.events$.pipe(
      filter((message) => message.type === type),
      map((message) => message.data as T),
    );
  }

  /** Sends a command and waits for the server's acknowledgement (rejects when not connected or on timeout). */
  async request<T>(event: string, payload: unknown, timeoutMs = 8_000): Promise<T> {
    const socket = this.socket;
    if (!socket?.connected) throw new Error('realtime.disconnected');
    return (await socket.timeout(timeoutMs).emitWithAck(event, payload)) as T;
  }

  /** Signed in (past a forced password change or two-factor enrolment, which the API allows nothing else during), the page shown, no maintenance. */
  private wanted(): boolean {
    const user = this.auth.user();
    const pendingStep = !!user?.mustChangePassword || (!!user?.mfaRequired && !user.mfaEnabled);
    return !!user && !pendingStep && this.shown() && !this.maintenance.active();
  }

  private start(): void {
    if (this.socket) return;
    clearTimeout(this.retryTimer);
    const socket = this.createSocket({
      path: SOCKET_PATH,
      transports: ['websocket'],
      autoConnect: false,
      reconnectionDelay: RETRY_BASE_MS,
      reconnectionDelayMax: RETRY_MAX_MS,
      auth: (send: (data: object) => void) => void this.credential().then((token) => send({ token })),
    });
    this.socket = socket;
    socket.onAny((type: string, data: unknown) => this.messages.next({ type, data }));
    socket.on('connect', () => {
      this.failures = 0;
      this.connected.set(true);
      this.connections.update((count) => count + 1);
    });
    socket.on('disconnect', (reason: string) => {
      this.connected.set(false);
      // The server closed it (its token expired, a re-check failed, maintenance began): connect again while still wanted.
      if (reason === 'io server disconnect') this.retry(socket);
    });
    socket.on('connect_error', (error: ConnectError) => this.refused(socket, error));
    socket.connect();
  }

  private stop(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const socket = this.socket;
    this.socket = null;
    this.connected.set(false);
    if (!socket) return;
    socket.removeAllListeners();
    socket.offAny();
    socket.disconnect();
  }

  /** A current access token: the one in memory unless it is (about to be) expired, otherwise refreshed; null when the session cannot go on. */
  private async credential(): Promise<string | null> {
    const token = this.tokens.accessToken();
    if (token && !expiresSoon(token)) return token;
    const refreshed = await firstValueFrom(this.auth.refreshAccessToken());
    if (!refreshed) this.expiry.end(this.auth.refusalReason() ?? 'session_expired');
    return refreshed;
  }

  /** Why the server refused the connection decides what happens next. */
  private refused(socket: Socket, error: ConnectError): void {
    if (socket !== this.socket) return;
    const message = error.data?.message ?? error.message;
    const status = error.data?.status;
    if (message === 'errors.maintenance') {
      this.stop();
      this.maintenance.enter();
      return;
    }
    const over = sessionEndReasonFor(message, status);
    if (over) {
      this.stop();
      this.expiry.end(over);
      return;
    }
    if (message === 'auth.errors.passwordChangeRequired' || message === 'auth.errors.mfaEnrollmentRequired') {
      this.stop();
      return;
    }
    // An expired or missing token is refreshed by `credential()` on the next attempt. A refusal by the server is not
    // retried by Socket.IO itself; a network failure is (socket.active).
    if (!socket.active) this.retry(socket);
  }

  /** Opens a new connection after a delay (1 s, doubling to 30 s with jitter), while still wanted. */
  private retry(socket: Socket): void {
    if (socket !== this.socket) return;
    this.stop();
    if (!this.wanted()) return;
    this.failures += 1;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (this.failures - 1)) * (0.5 + Math.random() / 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.wanted()) this.start();
    }, delay);
  }
}

/** Whether a JWT expires within the margin (read only to decide when to refresh — the server checks it). */
function expiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return !payload.exp || payload.exp * 1000 - Date.now() < TOKEN_MARGIN_MS;
  } catch {
    return true;
  }
}
