import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot, type UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { authGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AccountApi } from '../../features/account/account-api.service';
import { sessionEndReason } from './session-end';
import { TokenStore } from './token-store.service';

const API = '/api/v1';
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('expired sessions: the browser signs out when the API says the session is over', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/en/leads', navigate, createUrlTree: (commands: unknown[], extras: unknown) => ({ commands, extras }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    signInAs('sales_representative');
    TestBed.inject(TokenStore).save('access-1');
  });

  afterEach(() => http.verify());

  const get = (path: string) => firstValueFrom(TestBed.inject(HttpClient).get(`${API}/${path}`)).catch((error: unknown) => error);
  const signedOut = () => {
    const auth = TestBed.inject(AuthService);
    const tokens = TestBed.inject(TokenStore);
    return auth.user() === null && tokens.accessToken() === null && !tokens.wasSignedIn();
  };
  const loginNavigations = () => navigate.mock.calls.filter(([commands]) => (commands as string[]).includes('login'));

  it('an expired access token is refreshed and the request replayed — the user stays signed in', async () => {
    const result = get('leads');
    http.expectOne(`${API}/leads`).flush({ message: 'auth.errors.tokenExpired' }, { status: 401, statusText: 'Unauthorized' });
    await tick();
    const refresh = http.expectOne(`${API}/auth/refresh`);
    // The refresh token is the browser's HttpOnly cookie: never in the body, and the request carries credentials.
    expect(refresh.request.body).toEqual({});
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({ success: true, accessToken: 'access-2' });
    await tick();
    const replay = http.expectOne(`${API}/leads`);
    expect(replay.request.headers.get('Authorization')).toBe('Bearer access-2');
    replay.flush({ success: true, rows: [] });
    expect(await result).toEqual({ success: true, rows: [] });
    expect(signedOut()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('three requests failing at once: ONE refresh; when it fails, one sign-out and one trip to sign-in with "session expired"', async () => {
    const results = [get('leads'), get('tasks'), get('notifications')];
    for (const path of ['leads', 'tasks', 'notifications']) http.expectOne(`${API}/${path}`).flush({ message: 'auth.errors.tokenExpired' }, { status: 401, statusText: 'Unauthorized' });
    await tick();
    const refreshes = http.match(`${API}/auth/refresh`);
    expect(refreshes).toHaveLength(1);
    refreshes[0]!.flush({ message: 'auth.errors.invalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });
    await Promise.all(results);
    expect(signedOut()).toBe(true);
    expect(loginNavigations()).toHaveLength(1);
    expect(loginNavigations()[0]![1]).toMatchObject({ queryParams: { reason: 'session_expired', returnTo: '/en/leads' } });
  });

  it('a session ended from another device or by an administrator: signed out at once (no refresh can help), with that reason', async () => {
    const results = [get('leads'), get('tasks')];
    for (const path of ['leads', 'tasks']) http.expectOne(`${API}/${path}`).flush({ message: 'auth.errors.sessionRevoked' }, { status: 401, statusText: 'Unauthorized' });
    await Promise.all(results);
    http.expectNone(`${API}/auth/refresh`);
    expect(signedOut()).toBe(true);
    expect(loginNavigations()).toHaveLength(1);
    expect(loginNavigations()[0]![1]).toMatchObject({ queryParams: { reason: 'session_revoked' } });
  });

  it('a deactivated account and a password changed elsewhere each keep their own message', async () => {
    const first = get('leads');
    http.expectOne(`${API}/leads`).flush({ message: 'auth.errors.accountInactive' }, { status: 401, statusText: 'Unauthorized' });
    await first;
    expect(loginNavigations()[0]![1]).toMatchObject({ queryParams: { reason: 'account_inactive' } });

    signInAs('sales_representative');
    TestBed.inject(TokenStore).save('access-3');
    const second = get('leads');
    http.expectOne(`${API}/leads`).flush({ message: 'auth.errors.passwordChangedElsewhere' }, { status: 401, statusText: 'Unauthorized' });
    await second;
    expect(loginNavigations()[1]![1]).toMatchObject({ queryParams: { reason: 'password_changed_elsewhere' } });
  });

  it('other failures never sign anyone out — a missing permission, a forced password change, a validation error', async () => {
    const results = [get('audit'), get('leads'), get('customers')];
    http.expectOne(`${API}/audit`).flush({ message: 'errors.forbidden' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${API}/leads`).flush({ message: 'auth.errors.passwordChangeRequired' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${API}/customers`).flush({ message: 'errors.validation' }, { status: 400, statusText: 'Bad Request' });
    await Promise.all(results);
    http.expectNone(`${API}/auth/refresh`);
    expect(signedOut()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signing out normally shows no "session expired" — even if the session had already ended', async () => {
    const logout = TestBed.inject(AuthService).logout();
    http.expectOne(`${API}/auth/logout`).flush({ message: 'auth.errors.sessionRevoked' }, { status: 401, statusText: 'Unauthorized' });
    await logout;
    expect(signedOut()).toBe(true);
    expect(loginNavigations()).toHaveLength(0);
  });

  it('a wrong sign-in or code is an answer, not an expiry (no refresh, no sign-out)', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).post(`${API}/auth/login`, {})).catch((error: unknown) => error);
    http.expectOne(`${API}/auth/login`).flush({ message: 'auth.errors.invalidCredentials' }, { status: 401, statusText: 'Unauthorized' });
    await result;
    http.expectNone(`${API}/auth/refresh`);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a refused refresh says why when the API did (the session was revoked while the access token expired)', async () => {
    const result = get('leads');
    http.expectOne(`${API}/leads`).flush({ message: 'auth.errors.tokenExpired' }, { status: 401, statusText: 'Unauthorized' });
    await tick();
    http.expectOne(`${API}/auth/refresh`).flush({ message: 'auth.errors.sessionRevoked' }, { status: 401, statusText: 'Unauthorized' });
    await result;
    expect(signedOut()).toBe(true);
    expect(loginNavigations()[0]![1]).toMatchObject({ queryParams: { reason: 'session_revoked' } });
  });

  it('a 401 from the refresh call itself is never refreshed again (no loop)', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).post(`${API}/auth/refresh`, {})).catch((error: unknown) => error);
    http.expectOne(`${API}/auth/refresh`).flush({ message: 'auth.errors.invalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });
    await result;
    await tick();
    http.expectNone(`${API}/auth/refresh`);
  });

  it('a password change adopts the new access token at once (the old one no longer works); the cookie is the API\'s', async () => {
    const done = firstValueFrom(TestBed.inject(AccountApi).changePassword({ currentPassword: 'oldpass1', newPassword: 'newpass1', confirmPassword: 'newpass1' }));
    const change = http.expectOne(`${API}/auth/change-password`);
    expect(change.request.headers.get('Authorization')).toBe('Bearer access-1');
    change.flush({ success: true, accessToken: 'access-after-change' });
    await done;
    expect(TestBed.inject(TokenStore).accessToken()).toBe('access-after-change');
    expect(signedOut()).toBe(false);
  });

  it('no refresh token is ever kept by the browser app — even if a response carried one — and an older build\'s is removed', async () => {
    localStorage.setItem('ecotech.session', 'legacy-refresh');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TokenStore);
    expect(localStorage.getItem('ecotech.session')).toBeNull();
    const auth = TestBed.inject(AuthService);
    const signedIn = auth.login({ email: 'rep@ecotech.test', password: 'password1' });
    http.expectOne(`${API}/auth/login`).flush({ success: true, accessToken: 'access-9', refreshToken: 'must-not-be-kept' });
    await tick();
    http.expectOne(`${API}/auth/me`).flush({ success: true, user: { id: 'u1', permissions: {} } });
    await signedIn;
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('must-not-be-kept');
    expect(stored).not.toContain('access-9');
    expect(TestBed.inject(TokenStore).accessToken()).toBe('access-9');
  });

  it('a first visit with no session: one refresh attempt, then sign-in without any "expired" notice', async () => {
    const auth = TestBed.inject(AuthService);
    auth.endSession();
    const guard = TestBed.runInInjectionContext(() =>
      authGuard({ paramMap: { get: () => 'en' } } as unknown as ActivatedRouteSnapshot, { url: '/en/tasks' } as RouterStateSnapshot),
    ) as Promise<UrlTree>;
    await tick();
    http.expectOne(`${API}/auth/refresh`).flush({ message: 'auth.errors.invalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });
    const tree = (await guard) as unknown as { extras: { queryParams: Record<string, string> } };
    expect(tree.extras.queryParams).toEqual({ returnTo: '/en/tasks' });
  });

  it('a reload with a live session cookie resumes the session through one refresh', async () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set(null);
    TestBed.inject(TokenStore).accessToken.set(null);
    const guard = TestBed.runInInjectionContext(() =>
      authGuard({ paramMap: { get: () => 'en' } } as unknown as ActivatedRouteSnapshot, { url: '/en/tasks' } as RouterStateSnapshot),
    ) as Promise<boolean>;
    await tick();
    http.expectOne(`${API}/auth/refresh`).flush({ success: true, accessToken: 'access-r' });
    await tick();
    const me = http.expectOne(`${API}/auth/me`);
    expect(me.request.headers.get('Authorization')).toBe('Bearer access-r');
    me.flush({ success: true, user: { id: 'u1', permissions: {} } });
    expect(await guard).toBe(true);
  });

  it('a reload with a session the API no longer accepts: nothing stays signed in, and sign-in says it expired', async () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set(null);
    // Signed in earlier in this browser; the access token is gone with the reload.
    TestBed.inject(TokenStore).accessToken.set(null);
    const guard = TestBed.runInInjectionContext(() =>
      authGuard({ paramMap: { get: () => 'en' } } as unknown as ActivatedRouteSnapshot, { url: '/en/tasks' } as RouterStateSnapshot),
    ) as Promise<UrlTree>;
    await tick();
    http.expectOne(`${API}/auth/refresh`).flush({ message: 'auth.errors.invalidRefreshToken' }, { status: 401, statusText: 'Unauthorized' });
    const tree = (await guard) as unknown as { commands: string[]; extras: { queryParams: Record<string, string> } };
    expect(tree.commands).toEqual(['/', 'en', 'login']);
    expect(tree.extras.queryParams).toEqual({ returnTo: '/en/tasks', reason: 'session_expired' });
    expect(signedOut()).toBe(true);
  });
});

describe('sessionEndReason — which API answers end the session', () => {
  const error = (status: number, message: string) => new HttpErrorResponse({ status, error: { message } });
  it('maps the session-over answers, and nothing else', () => {
    expect(sessionEndReason(error(401, 'auth.errors.sessionRevoked'))).toBe('session_revoked');
    expect(sessionEndReason(error(401, 'auth.errors.sessionIdle'))).toBe('session_expired');
    expect(sessionEndReason(error(403, 'auth.errors.accountInactive'))).toBe('account_inactive');
    expect(sessionEndReason(error(401, 'auth.errors.tokenExpired'))).toBeNull();
    expect(sessionEndReason(error(403, 'auth.errors.sessionRevoked'))).toBeNull();
    expect(sessionEndReason(error(403, 'errors.forbidden'))).toBeNull();
    expect(sessionEndReason(new Error('x'))).toBeNull();
  });
});
