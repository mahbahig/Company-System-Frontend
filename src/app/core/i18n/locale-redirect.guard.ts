import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { I18nService } from './i18n.service';

/** `/` → `/<last used language>/dashboard`. */
export const localeRedirectGuard: CanActivateFn = () =>
  inject(Router).createUrlTree(['/', inject(I18nService).preferredLocale(), 'dashboard']);
