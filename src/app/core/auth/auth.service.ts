import { Service, computed, inject, signal } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { catchError, finalize, firstValueFrom, map, of, shareReplay, tap, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import { LocalStore } from '../storage/local-store.service';
import { DRAFT_PREFIX } from '../storage/storage-keys';
import type { AuthTokens } from './models/auth-tokens.interface';
import type { CurrentUser } from './models/current-user.interface';
import type { LoginCredentials } from './models/login-credentials.interface';
import type { MfaChallenge, MfaCodeSent } from './models/mfa-challenge.interface';
import { isReadPermission, type PermissionCode } from './permission-code';
import { QUIET_SESSION_END, sessionEndReason, type SessionEndReason } from './session-end';
import { SCOPE_RANK, type Scope } from './scope';
import { TokenStore } from './token-store.service';

/**
 * Session state for the whole app (signals).
 *
 * The UI uses `can()` to HIDE what the user cannot do; the backend re-checks
 * every request, so this is an affordance, never a security control.
 */
@Service()
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStore);
  private readonly store = inject(LocalStore);

  private restoring: Promise<boolean> | null = null;
  private refreshing$: Observable<string | null> | null = null;

  /** Why the last refresh was refused, when the API said (revoked, password changed elsewhere, deactivated …). */
  private readonly refusal = signal<SessionEndReason | null>(null);

  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  /** Read-only profile: every change is hidden, whatever the permissions say. */
  readonly isReadOnly = computed(() => !!this.user()?.isReadOnly);
  /** Manages at least one team: the API's team records say so (`managedTeamIds`), never a role name. */
  readonly managesTeam = computed(() => !!this.user()?.managedTeamIds?.length);

  /**
   * First sign-in step. Returns the profile, or — when the account has
   * two-factor sign-in on (AUTH-06) — the challenge: a code was e-mailed to
   * the account's own address; then call `verifyMfa` (no session exists yet).
   */
  async login(credentials: LoginCredentials): Promise<CurrentUser | MfaChallenge> {
    const issued = await firstValueFrom(this.api.post<AuthTokens | (MfaChallenge & { mfaRequired: true })>('auth/login', credentials));
    if ('mfaToken' in issued) return { mfaToken: issued.mfaToken, destination: issued.destination, expiresAt: issued.expiresAt, resendAvailableAt: issued.resendAvailableAt };
    // The refresh token arrived as the HttpOnly cookie; only the access token is ours to keep (in memory).
    this.tokens.save(issued.accessToken);
    return this.loadProfile();
  }

  /** Another e-mailed code for the same sign-in (the API enforces the wait and the hourly limit). */
  resendMfa(mfaToken: string): Promise<MfaCodeSent> {
    return firstValueFrom(this.api.post<MfaCodeSent>('auth/mfa/resend', { mfaToken }));
  }

  /** Second sign-in step: the challenge token plus the e-mailed code. */
  async verifyMfa(mfaToken: string, code: string): Promise<CurrentUser> {
    const issued = await firstValueFrom(this.api.post<AuthTokens>('auth/mfa/verify', { mfaToken, code }));
    this.tokens.save(issued.accessToken);
    return this.loadProfile();
  }

  /**
   * Resumes the session once per page load (reload / deep link): the
   * browser's refresh cookie → access token → profile. Resolves false when
   * there is no usable session.
   */
  restore(): Promise<boolean> {
    if (this.user()) return Promise.resolve(true);
    this.restoring ??= this.resumeSession().finally(() => (this.restoring = null));
    return this.restoring;
  }

  /**
   * Obtains a new access token with the HttpOnly refresh cookie (the browser
   * sends it; no script sees it; the API rotates it). Concurrent 401s share
   * ONE refresh call, so a burst of failing requests does not refresh
   * repeatedly. Null when the session cannot be refreshed — the caller ends
   * it (the interceptor with a notice, a page-load resume quietly);
   * `refusalReason()` then says why when the API did.
   */
  refreshAccessToken(): Observable<string | null> {
    this.refreshing$ ??= this.api.post<AuthTokens>('auth/refresh', {}, { withCredentials: true }).pipe(
      map(({ accessToken }) => accessToken),
      tap((accessToken) => {
        this.refusal.set(null);
        this.tokens.save(accessToken);
      }),
      catchError((error: unknown) => {
        this.refusal.set(sessionEndReason(error));
        return of(null);
      }),
      finalize(() => (this.refreshing$ = null)),
      shareReplay(1),
    );
    return this.refreshing$;
  }

  /** Why the last refresh was refused, when the API said so (null: no session, or simply expired). */
  refusalReason(): SessionEndReason | null {
    return this.refusal();
  }

  /** New credentials for this session from the API (a password change): the access token here, the refresh cookie in the browser. */
  adoptAccessToken(accessToken: string): void {
    this.tokens.save(accessToken);
  }

  /**
   * Explicit sign-out. Also removes unsent form drafts (they may hold customer
   * details) so the next person on this browser finds none; an expired
   * session keeps them, which is exactly when a draft saves the work.
   */
  async logout(): Promise<void> {
    if (this.tokens.accessToken()) {
      // Signing out: an already-ended session is no news to the user (no "expired" notice).
      // The API also removes the refresh cookie.
      await firstValueFrom(this.api.post<void>('auth/logout', {}, { context: new HttpContext().set(QUIET_SESSION_END, true), withCredentials: true })).catch(() => undefined);
    }
    this.endSession();
    this.store.removeByPrefix(DRAFT_PREFIX);
  }

  /** Whether this browser holds (or held, until it ended) a session — something to end or to explain. */
  hasSession(): boolean {
    return !!this.user() || !!this.tokens.accessToken() || this.tokens.wasSignedIn();
  }

  /** Drops the local session (after logout, or when the server rejects it). */
  endSession(): void {
    this.tokens.clear();
    this.user.set(null);
  }

  /**
   * True when the user holds `permission` with at least `atLeast` scope. Fails
   * closed: no profile, an unknown scope, or a change on a read-only profile
   * all answer false.
   */
  can(permission: PermissionCode, atLeast: Scope = 'own'): boolean {
    const user = this.user();
    if (!user) return false;
    if (user.isReadOnly && !isReadPermission(permission)) return false;
    const scope = user.permissions[permission];
    return !!scope && scope in SCOPE_RANK && SCOPE_RANK[scope] >= SCOPE_RANK[atLeast];
  }

  canAny(permissions: readonly PermissionCode[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  async loadProfile(): Promise<CurrentUser> {
    const { user } = await firstValueFrom(this.api.get<{ user: CurrentUser }>('auth/me'));
    this.user.set(user);
    return user;
  }

  private async resumeSession(): Promise<boolean> {
    if (!this.tokens.accessToken()) {
      const accessToken = await firstValueFrom(this.refreshAccessToken());
      if (!accessToken) {
        // No session, or one the API no longer accepts: drop it so nothing looks signed in.
        this.endSession();
        return false;
      }
    }
    try {
      await this.loadProfile();
      return true;
    } catch {
      this.endSession();
      return false;
    }
  }
}
