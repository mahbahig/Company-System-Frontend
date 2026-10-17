import { Service, inject } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../i18n/i18n.service';
import { AuthService } from './auth.service';
import type { SessionEndReason } from './session-end';

/**
 * Ends the local session when the API says it is over — expired, ended from
 * another device or by an administrator, the password changed elsewhere, the
 * account deactivated. The credentials and the signed-in user are cleared
 * first (so nothing still looks or acts signed in; user-scoped state such as
 * favorites and recent records follows the user), then the sign-in page
 * opens and says why. However many requests failed at the same moment, this
 * happens once: the first call ends the session, later ones find none.
 */
@Service()
export class SessionExpiry {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  end(reason: SessionEndReason): void {
    if (!this.auth.hasSession()) return;
    this.auth.endSession();
    const current = this.router.url;
    const returnTo = current && current !== '/' && !/\/login(\?|$)/.test(current) ? current : undefined;
    void this.router.navigate(['/', this.i18n.locale(), 'login'], { queryParams: { reason, ...(returnTo ? { returnTo } : {}) } });
  }
}
