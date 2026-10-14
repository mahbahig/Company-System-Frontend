import { Service, computed, inject, signal } from '@angular/core';
import { catchError, finalize, firstValueFrom, map, of, shareReplay, tap, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import { LocalStore } from '../storage/local-store.service';
import { DRAFT_PREFIX } from '../storage/storage-keys';
import type { AuthTokens } from './models/auth-tokens.interface';
import type { CurrentUser } from './models/current-user.interface';
import type { LoginCredentials } from './models/login-credentials.interface';
import { isReadPermission, type PermissionCode } from './permission-code';
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

  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  /** Read-only profile: every change is hidden, whatever the permissions say. */
  readonly isReadOnly = computed(() => !!this.user()?.isReadOnly);

  /**
   * First sign-in step. Returns the profile, or `{ mfaToken }` when the
   * account has two-factor sign-in enabled (AUTH-06) — then call `verifyMfa`.
   */
  async login(credentials: LoginCredentials): Promise<CurrentUser | { mfaToken: string }> {
    const issued = await firstValueFrom(this.api.post<AuthTokens | { mfaRequired: true; mfaToken: string }>('auth/login', credentials));
    if ('mfaToken' in issued) return { mfaToken: issued.mfaToken };
    this.tokens.save(issued.accessToken, issued.refreshToken);
    return this.loadProfile();
  }

  /** Second sign-in step: the challenge token plus a TOTP or recovery code. */
  async verifyMfa(mfaToken: string, code: string): Promise<CurrentUser> {
    const issued = await firstValueFrom(this.api.post<AuthTokens>('auth/mfa/verify', { mfaToken, code }));
    this.tokens.save(issued.accessToken, issued.refreshToken);
    return this.loadProfile();
  }

  /**
   * Resumes a stored session once per page load (reload / deep link):
   * refresh token → access token → profile. Resolves false when there is no
   * usable session.
   */
  restore(): Promise<boolean> {
    if (this.user()) return Promise.resolve(true);
    this.restoring ??= this.resumeSession().finally(() => (this.restoring = null));
    return this.restoring;
  }

  /**
   * Obtains a new access token. Concurrent 401s share ONE refresh call, so a
   * burst of failing requests does not spend the refresh token repeatedly.
   */
  refreshAccessToken(): Observable<string | null> {
    const refreshToken = this.tokens.refreshToken();
    if (!refreshToken) return of(null);
    this.refreshing$ ??= this.api.post<{ accessToken: string }>('auth/refresh', { refreshToken }).pipe(
      map(({ accessToken }) => accessToken),
      tap((accessToken) => this.tokens.save(accessToken)),
      catchError(() => {
        this.endSession();
        return of(null);
      }),
      finalize(() => (this.refreshing$ = null)),
      shareReplay(1),
    );
    return this.refreshing$;
  }

  /**
   * Explicit sign-out. Also removes unsent form drafts (they may hold customer
   * details) so the next person on this browser finds none; an expired
   * session keeps them, which is exactly when a draft saves the work.
   */
  async logout(): Promise<void> {
    if (this.tokens.accessToken()) {
      await firstValueFrom(this.api.post<void>('auth/logout')).catch(() => undefined);
    }
    this.endSession();
    this.store.removeByPrefix(DRAFT_PREFIX);
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
      if (!accessToken) return false;
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
