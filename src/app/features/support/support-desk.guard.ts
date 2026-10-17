import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Filing a ticket — and the list of one's own — is for the employees the
 * support desk serves, not for the desk (`support.manage`, the System
 * Administrator), which answers them: it is sent to its own list instead.
 * UX only — the API refuses a ticket from the desk (403).
 */
export const notSupportDeskGuard: CanActivateFn = () =>
  inject(AuthService).can('support.manage') ? inject(Router).createUrlTree(['/admin', 'support-tickets']) : true;
