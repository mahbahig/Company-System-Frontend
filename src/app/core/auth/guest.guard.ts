import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { toLocale } from '../i18n/locale';
import { AuthService } from './auth.service';

/** The login page is for signed-out users; a live session goes to the dashboard. */
export const guestGuard: CanActivateFn = async (route) => {
  // inject() only works before the first await (injection context).
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!(await auth.restore())) return true;
  return router.createUrlTree(['/', toLocale(route.paramMap.get('locale')), 'dashboard']);
};
