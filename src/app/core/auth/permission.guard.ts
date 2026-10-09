import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { toLocale } from '../i18n/locale';
import { AuthService } from './auth.service';
import type { PermissionCode } from './permission-code';

/**
 * Route-level permission check from `data: { permission }` (one code or any
 * of several). UX only — the API enforces access on every request.
 *
 * Also keeps a user on their account pages while a forced password change
 * (AUTH-02) or a required two-factor enrolment (AUTH-06) is outstanding.
 */
export const permissionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const locale = toLocale(route.paramMap.get('locale') ?? route.parent?.paramMap.get('locale') ?? null);
  const user = auth.user();
  const onAccount = /^\/[a-z]{2}\/account(\/|$|\?)/.test(state.url);
  if (user && !onAccount) {
    if (user.mustChangePassword) return router.createUrlTree(['/', locale, 'account', 'password']);
    if (user.mfaRequired && !user.mfaEnabled) return router.createUrlTree(['/', locale, 'account', 'security'], { queryParams: { enroll: 1 } });
  }
  const required = route.data['permission'] as PermissionCode | PermissionCode[] | undefined;
  if (!required) return true;
  if (auth.canAny(Array.isArray(required) ? required : [required])) return true;
  return router.createUrlTree(['/', locale, 'forbidden']);
};
