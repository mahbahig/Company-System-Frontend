import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { toLocale } from '../i18n/locale';
import { AuthService } from './auth.service';

/**
 * Protects the application shell: resumes the session (the refresh cookie)
 * if there is one, otherwise redirects to `/<locale>/login?returnTo=…` —
 * saying why when this browser held a session the API no longer accepts (a
 * reload or a deep link after it ended), so stale credentials never look
 * signed in.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  // inject() only works before the first await (injection context).
  const auth = inject(AuthService);
  const router = inject(Router);
  const hadSession = auth.hasSession();
  if (await auth.restore()) return true;
  const locale = toLocale(route.paramMap.get('locale'));
  return router.createUrlTree(['/', locale, 'login'], { queryParams: { returnTo: state.url, ...(hadSession ? { reason: auth.refusalReason() ?? 'session_expired' } : {}) } });
};
