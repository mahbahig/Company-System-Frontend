import { Service, inject, signal } from '@angular/core';

import { LocalStore } from '../storage/local-store.service';

/** Where older builds kept the refresh token; removed on start-up and never read. */
const LEGACY_REFRESH_KEY = 'ecotech.session';
/** "This browser was signed in" — no credential, only so an ended session can be explained on the sign-in page. */
const SIGNED_IN_KEY = 'ecotech.signedIn';

/**
 * Holds the session's access token — in memory only (never persisted, gone
 * on reload). The refresh token is not here at all: the API keeps it in an
 * HttpOnly cookie that no script can read, sends it with `auth/refresh`
 * only, and rotates it there; a reload resumes the session through that
 * refresh.
 */
@Service()
export class TokenStore {
  private readonly store = inject(LocalStore);

  readonly accessToken = signal<string | null>(null);

  constructor() {
    // A refresh token an older build left in storage is never used again.
    this.store.remove(LEGACY_REFRESH_KEY);
  }

  save(accessToken: string): void {
    this.accessToken.set(accessToken);
    this.store.set(SIGNED_IN_KEY, '1');
  }

  /** Whether this browser held a session (signed in and not signed out since). */
  wasSignedIn(): boolean {
    return this.store.get(SIGNED_IN_KEY) === '1';
  }

  clear(): void {
    this.accessToken.set(null);
    this.store.remove(SIGNED_IN_KEY);
  }
}
