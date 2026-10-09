import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { toLocale } from '../i18n/locale';
import { AuthService } from './auth.service';

/**
 * Protects the application shell: resumes a stored session if there is one,
 * otherwise redirects to `/<locale>/login?returnTo=…`.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  // inject() only works before the first await (injection context).
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.restore()) return true;
  const locale = toLocale(route.paramMap.get('locale'));
  return router.createUrlTree(['/', locale, 'login'], { queryParams: { returnTo: state.url } });
};
