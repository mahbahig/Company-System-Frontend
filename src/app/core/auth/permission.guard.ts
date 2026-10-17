import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from './auth.service';
import type { PermissionCode } from './permission-code';

/**
 * Route-level permission check from `data: { permission }` (one code or any
 * of several) plus optional `data: { requiresAll }` (every code), for clicks,
 * typed URLs, refreshes and deep links alike.
 * Fails closed: no profile means sign in again. UX only — the API enforces
 * access on every request.
 *
 * Also keeps a user on their account pages while a forced password change
 * (AUTH-02) or a required two-factor enrolment (AUTH-06) is outstanding.
 */
export const permissionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  // Fail closed: without a resolved profile nothing can be authorized.
  if (!user) return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  const onAccount = /^\/account(\/|$|\?)/.test(state.url);
  if (!onAccount) {
    if (user.mustChangePassword) return router.createUrlTree(['/account', 'password']);
    if (user.mfaRequired && !user.mfaEnabled) return router.createUrlTree(['/account', 'security'], { queryParams: { enroll: 1 } });
  }
  const required = route.data['permission'] as PermissionCode | PermissionCode[] | undefined;
  const requiresAll = (route.data['requiresAll'] as PermissionCode[] | undefined) ?? [];
  const anyOk = !required || auth.canAny(Array.isArray(required) ? required : [required]);
  const allOk = requiresAll.every((permission) => auth.can(permission));
  if (anyOk && allOk) return true;
  return router.createUrlTree(['/forbidden']);
};
