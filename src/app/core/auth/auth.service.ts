import { Service, computed, inject, signal } from '@angular/core';
import { catchError, finalize, firstValueFrom, map, of, shareReplay, tap, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { AuthTokens } from './models/auth-tokens.interface';
import type { CurrentUser } from './models/current-user.interface';
import type { LoginCredentials } from './models/login-credentials.interface';
import type { PermissionCode } from './permission-code';
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

  private restoring: Promise<boolean> | null = null;
  private refreshing$: Observable<string | null> | null = null;

  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

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

  async logout(): Promise<void> {
    if (this.tokens.accessToken()) {
      await firstValueFrom(this.api.post<void>('auth/logout')).catch(() => undefined);
    }
    this.endSession();
  }

  /** Drops the local session (after logout, or when the server rejects it). */
  endSession(): void {
    this.tokens.clear();
    this.user.set(null);
  }

  /** True when the user holds `permission` with at least `atLeast` scope. */
  can(permission: PermissionCode, atLeast: Scope = 'own'): boolean {
    const scope = this.user()?.permissions[permission];
    return !!scope && SCOPE_RANK[scope] >= SCOPE_RANK[atLeast];
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
