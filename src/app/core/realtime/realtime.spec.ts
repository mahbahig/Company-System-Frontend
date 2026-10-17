import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { signInAs } from '../../../testing/as-role';
import { fakeSocketFactory, type FakeSocket } from '../../../testing/fake-socket';
import { routes } from '../../app.routes';
import { LoginPage } from '../../features/auth/login/login.page';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { SessionExpiry } from '../auth/session-expiry.service';
import { TokenStore } from '../auth/token-store.service';
import { ChatStore } from '../chat/chat-store.service';
import { I18nService } from '../i18n/i18n.service';
import { maintenanceInterceptor } from '../maintenance/maintenance.interceptor';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService, SOCKET_FACTORY, SOCKET_PATH } from './realtime.service';
import { SecurityEvents } from './security-events.service';
import { SystemLockChanges, type SystemLockEvent } from './system-lock-changes.service';

const API = environment.apiBaseUrl;
const tick = () => new Promise((resolve) => setTimeout(resolve));
const ACTOR = { nameEn: 'Ahmed Mohamed', nameAr: 'أحمد محمد' };
const lockedEvent: SystemLockEvent = { locked: true, actor: ACTOR, occurredAt: '2026-10-17T14:02:00.000Z' };

/** A JWT-shaped access token (only its expiry is read in the browser — to know when to refresh). */
function jwt(secondsFromNow: number, label = 'a'): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256' })}.${encode({ sid: label, exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.signature`;
}

describe('Realtime over Socket.IO — one authenticated connection, security events', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let sockets: ReturnType<typeof fakeSocketFactory>;
  const TOKEN = jwt(600);

  const socket = (): FakeSocket => {
    const last = sockets.last();
    if (!last) throw new Error('no socket was created');
    return last;
  };
  /** The connection after the auth callback ran (it may refresh first). */
  const connected = async (): Promise<FakeSocket> => {
    await tick();
    socket().accept();
    return socket();
  };
  const start = () => {
    TestBed.inject(SecurityEvents);
    TestBed.tick();
  };

  beforeEach(() => {
    navigate = vi.fn(async () => true);
    sockets = fakeSocketFactory();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([maintenanceInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/leads', navigate, createUrlTree: (commands: unknown[], extras: unknown) => ({ commands, extras }) } },
        { provide: SOCKET_FACTORY, useValue: sockets.factory },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStore).save(TOKEN);
    TestBed.inject(I18nService).locale.set('en');
    vi.spyOn(TestBed.inject(I18nService), 't').mockImplementation((key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key));
  });

  afterEach(() => vi.useRealTimers());

  it('connects only while someone is signed in: WebSocket only, at the API path, the token in the handshake auth payload (never the URL)', async () => {
    start();
    expect(sockets.sockets).toHaveLength(0);
    signInAs('sales_representative');
    TestBed.tick();
    expect(sockets.sockets).toHaveLength(1);
    expect(socket().options).toMatchObject({ path: SOCKET_PATH, transports: ['websocket'], autoConnect: false });
    expect(JSON.stringify(socket().options)).not.toContain(TOKEN);
    await tick();
    expect(socket().handshake).toEqual({ token: TOKEN });
    socket().accept();
    expect(TestBed.inject(RealtimeService).connected()).toBe(true);
  });

  it('no connection while a forced password change or two-factor enrolment is pending (the API refuses everything else then)', () => {
    const auth = TestBed.inject(AuthService);
    start();
    auth.user.set({ ...signInAs('sales_representative'), mustChangePassword: true });
    TestBed.tick();
    expect(sockets.sockets).toHaveLength(0);
    auth.user.set({ ...auth.user()!, mustChangePassword: false, mfaRequired: true, mfaEnabled: false });
    TestBed.tick();
    expect(sockets.sockets).toHaveLength(0);
    auth.user.set({ ...auth.user()!, mfaEnabled: true });
    TestBed.tick();
    expect(sockets.sockets).toHaveLength(1);
  });

  it('ONE socket per tab whatever subscribes: listeners are the service’s, each event reaches each subscriber once, and unsubscribing stops it', async () => {
    signInAs('sales_representative');
    start();
    TestBed.inject(NotificationsService).listen();
    TestBed.inject(NotificationsService).listen();
    TestBed.inject(ChatStore).listen();
    TestBed.inject(ChatStore).listen();
    TestBed.tick();
    const live = await connected();
    expect(sockets.sockets).toHaveLength(1);
    const realtime = TestBed.inject(RealtimeService);
    const first: unknown[] = [];
    const second: unknown[] = [];
    const a = realtime.on('chat:typing').subscribe((data) => first.push(data));
    const b = realtime.on('chat:typing').subscribe((data) => second.push(data));
    live.push('chat:typing', { chatId: 'c1' });
    a.unsubscribe();
    live.push('chat:typing', { chatId: 'c2' });
    b.unsubscribe();
    expect(first).toEqual([{ chatId: 'c1' }]);
    expect(second).toEqual([{ chatId: 'c1' }, { chatId: 'c2' }]);
  });

  describe('FORCE_LOGOUT', () => {
    const cases: Array<[string, string]> = [
      ['ADMIN_LOGOUT_ALL_SESSIONS', 'session_revoked'],
      ['SESSION_REVOKED', 'session_revoked'],
      ['PASSWORD_CHANGED', 'password_changed_elsewhere'],
      ['ACCOUNT_DEACTIVATED', 'account_inactive'],
      ['SESSION_EXPIRED', 'session_expired'],
    ];
    for (const [reason, notice] of cases) {
      it(`${reason}: signed out at once — token and user cleared, socket closed, the sign-in page saying why (${notice})`, async () => {
        signInAs('sales_representative');
        start();
        const live = await connected();
        live.push('FORCE_LOGOUT', { reason });
        expect(TestBed.inject(AuthService).user()).toBeNull();
        expect(TestBed.inject(TokenStore).accessToken()).toBeNull();
        expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: notice, returnTo: '/leads' } });
        TestBed.tick();
        expect(live.connected).toBe(false);
        // Signed out: no new connection.
        live.close();
        TestBed.tick();
        expect(sockets.sockets).toHaveLength(1);
      });
    }

    it('SIGNED_OUT (another tab of this browser signed out): quietly to the sign-in page, no notice', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      live.push('FORCE_LOGOUT', { reason: 'SIGNED_OUT' });
      expect(TestBed.inject(AuthService).user()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/login']);
      expect(TestBed.inject(SessionExpiry).lastNotice()).toBeNull();
    });

    it('is idempotent: the event, then a 401 for a request already on its way, then the event again — one sign-out, one navigation', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      const request = firstValueFrom(TestBed.inject(HttpTestingController) && TestBed.inject(NotificationsService).list({ page: 1, pageSize: 20 })).catch((error: unknown) => error);
      live.push('FORCE_LOGOUT', { reason: 'ADMIN_LOGOUT_ALL_SESSIONS' });
      http.expectOne(`${API}/notifications?page=1&pageSize=20`).flush({ message: 'auth.errors.sessionRevoked' }, { status: 401, statusText: 'Unauthorized' });
      expect(await request).toBeInstanceOf(HttpErrorResponse);
      live.push('FORCE_LOGOUT', { reason: 'ADMIN_LOGOUT_ALL_SESSIONS' });
      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('an unknown reason still signs out (as revoked); a malformed payload never crashes', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      live.push('FORCE_LOGOUT', null);
      expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'session_revoked', returnTo: '/leads' } });
    });
  });

  describe('SYSTEM_LOCKED', () => {
    it('an employee: signed out at once, the sign-in page naming who locked it', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      live.push('SYSTEM_LOCKED', lockedEvent);
      expect(TestBed.inject(AuthService).user()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'system_locked', returnTo: '/leads' } });
      expect(TestBed.inject(SessionExpiry).lastNotice()).toEqual({ reason: 'system_locked', actorName: 'Ahmed Mohamed' });
      expect(TestBed.inject(ToastService).toasts()).toEqual([]);
    });

    it('a Super Administrator stays signed in: a toast names who locked it, the bell refreshes, the status card is told', async () => {
      const user = signInAs('system_administrator');
      start();
      const announced: SystemLockEvent[] = [];
      TestBed.inject(SystemLockChanges).changes$.subscribe((event) => announced.push(event));
      const live = await connected();
      live.push('SYSTEM_LOCKED', lockedEvent);
      expect(TestBed.inject(AuthService).user()).toBe(user);
      expect(TestBed.inject(ToastService).toasts()[0]).toMatchObject({ tone: 'warning', title: 'realtime.systemLocked.title', message: 'realtime.systemLocked.body {"name":"Ahmed Mohamed"}' });
      http.expectOne(`${API}/notifications/unread-count`);
      expect(announced).toEqual([lockedEvent]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('the name follows the language; a malformed event changes nothing', async () => {
      signInAs('sales_representative');
      TestBed.inject(I18nService).locale.set('ar');
      start();
      const live = await connected();
      live.push('SYSTEM_LOCKED', { locked: true, actor: { nameEn: 'X' } });
      expect(TestBed.inject(AuthService).user()).not.toBeNull();
      live.push('SYSTEM_LOCKED', lockedEvent);
      expect(TestBed.inject(SessionExpiry).lastNotice()?.actorName).toBe('أحمد محمد');
    });
  });

  describe('refusals and reconnects', () => {
    it('a refused connection whose session is over (new stamp, revoked, locked) signs out with that reason — and does not retry', async () => {
      signInAs('sales_representative');
      start();
      await tick();
      socket().refuse('auth.errors.sessionRevoked', 401);
      expect(TestBed.inject(AuthService).user()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'session_revoked', returnTo: '/leads' } });
      TestBed.tick();
      expect(sockets.sockets).toHaveLength(1);
    });

    it('refused for maintenance: the maintenance screen, and no socket while it lasts', async () => {
      signInAs('sales_representative');
      start();
      await tick();
      socket().refuse('errors.maintenance', 503);
      expect(TestBed.inject(MaintenanceService).active()).toBe(true);
      TestBed.tick();
      expect(sockets.sockets).toHaveLength(1);
      expect(socket().active).toBe(false);
    });

    it('an access token about to expire is refreshed (HttpOnly cookie) before it is used to connect', async () => {
      TestBed.inject(TokenStore).save(jwt(5, 'old'));
      signInAs('sales_representative');
      start();
      const refreshed = jwt(900, 'new');
      http.expectOne(`${API}/auth/refresh`).flush({ accessToken: refreshed });
      await tick();
      expect(socket().handshake).toEqual({ token: refreshed });
    });

    it('the server closing the socket (its token expired, a re-check failed) → a new authenticated connection after a short delay', async () => {
      vi.useFakeTimers();
      signInAs('sales_representative');
      start();
      await vi.advanceTimersByTimeAsync(0);
      socket().accept();
      socket().push('REAUTHENTICATE', {});
      socket().close();
      expect(sockets.sockets).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1_100);
      expect(sockets.sockets).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(0);
      expect(socket().handshake).toEqual({ token: TOKEN });
    });

    it('signing out closes the socket; maintenance closes it too', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      TestBed.inject(AuthService).endSession();
      TestBed.tick();
      expect(live.connected).toBe(false);
      signInAs('sales_representative');
      TestBed.tick();
      const again = await connected();
      TestBed.inject(MaintenanceService).active.set(true);
      TestBed.tick();
      expect(again.connected).toBe(false);
    });

    it('a page parked in the back/forward cache lets its socket go and connects again when shown', async () => {
      signInAs('sales_representative');
      start();
      const live = await connected();
      window.dispatchEvent(new Event('pagehide'));
      TestBed.tick();
      expect(live.connected).toBe(false);
      window.dispatchEvent(new Event('pageshow'));
      TestBed.tick();
      expect(sockets.sockets).toHaveLength(2);
    });
  });

  describe('live notifications (no polling)', () => {
    it('a new notification arrives on the bell at once — counted unread, on top, each id once; a reconnect reads the API again', async () => {
      signInAs('sales_representative');
      start();
      const notifications = TestBed.inject(NotificationsService);
      notifications.listen();
      const live = await connected();
      const note = { id: 'n1', category: 'task.assigned', isCritical: false, titleAr: 'م', titleEn: 'T', readAt: null, createdAt: '2026-10-17T10:00:00Z' };
      live.push('NOTIFICATION_CREATED', note);
      live.push('NOTIFICATION_CREATED', note);
      expect(notifications.unreadCount()).toBe(1);
      expect(notifications.recent().map((item) => item.id)).toEqual(['n1']);
      http.expectNone(`${API}/notifications/unread-count`);
      live.close();
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      TestBed.tick();
      await tick();
      socket().accept();
      TestBed.tick();
      http.expectOne(`${API}/notifications/unread-count`);
    });
  });
});

describe('The sign-in page after a system lock', () => {
  async function render(reason: string): Promise<{ fixture: ComponentFixture<LoginPage>; root: HTMLElement }> {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentRef.setInput('reason', reason);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await tick();
    }
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: fakeSocketFactory().factory }] });
    vi.spyOn(TestBed.inject(I18nService), 't').mockImplementation((key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key));
  });

  it('names the Super Administrator when this browser heard it from the realtime event', async () => {
    signInAs('sales_representative');
    TestBed.inject(TokenStore).save('access-1');
    TestBed.inject(SessionExpiry).end('system_locked', { actorName: 'Ahmed Mohamed' });
    const { root } = await render('system_locked');
    expect(root.querySelector('[data-testid="login-notice"]')!.textContent).toContain('auth.login.systemLockedByNotice {"name":"Ahmed Mohamed"}');
  });

  it('says it generically otherwise (a reload, a refused request) — the URL never supplies a name', async () => {
    const { root } = await render('system_locked');
    expect(root.querySelector('[data-testid="login-notice"]')!.textContent!.trim()).toBe('auth.login.systemLockedNotice');
  });
});
