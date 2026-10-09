import { Service, inject, signal } from '@angular/core';

import { LocalStore } from '../storage/local-store.service';

const REFRESH_KEY = 'ecotech.session';

/**
 * Holds the session tokens.
 *
 * The access token lives in memory only (it is short-lived and never
 * persisted). The refresh token is persisted so a reload keeps the session;
 * the backend returns it in the response body, and rotates / revokes it on
 * logout, password change and forced logout.
 */
@Service()
export class TokenStore {
  private readonly store = inject(LocalStore);

  readonly accessToken = signal<string | null>(null);

  refreshToken(): string | null {
    return this.store.get(REFRESH_KEY);
  }

  save(accessToken: string, refreshToken?: string): void {
    this.accessToken.set(accessToken);
    if (refreshToken) this.store.set(REFRESH_KEY, refreshToken);
  }

  clear(): void {
    this.accessToken.set(null);
    this.store.remove(REFRESH_KEY);
  }
}
