import { Service, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import type { SessionEndReason } from './session-end';

/** Why the last session ended, with what only this browser heard (who locked the system — from the realtime event, never the URL). */
export interface SessionEndNotice {
  reason: SessionEndReason;
  actorName: string | null;
}

/**
 * Ends the local session when the API says it is over — expired, ended from
 * another device or by an administrator, the password changed elsewhere, the
 * account deactivated. The credentials and the signed-in user are cleared
 * first (so nothing still looks or acts signed in; user-scoped state such as
 * favorites and recent records follows the user), then the sign-in page
 * opens and says why. However many requests failed at the same moment, this
 * happens once: the first call ends the session, later ones find none.
 *
 * `lastNotice` keeps the detail the sign-in page names in its notice (the
 * Super Administrator who locked the system), in memory only — the URL
 * carries the reason alone, so nobody can put words in it with a link.
 */
@Service()
export class SessionExpiry {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly lastNotice = signal<SessionEndNotice | null>(null);

  end(reason: SessionEndReason, detail: { actorName?: string | null } = {}): void {
    if (!this.auth.hasSession()) return;
    this.lastNotice.set({ reason, actorName: detail.actorName ?? null });
    this.auth.endSession();
    const current = this.router.url;
    const returnTo = current && current !== '/' && !/\/login(\?|$)/.test(current) ? current : undefined;
    void this.router.navigate(['/login'], { queryParams: { reason, ...(returnTo ? { returnTo } : {}) } });
  }
}
