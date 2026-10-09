import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { I18nService } from './i18n.service';
import { isLocale } from './locale';

/**
 * Guards the `/:locale` prefix: loads that language before any page renders.
 * An unsupported locale is a 404 rather than a silent fallback, so broken
 * links are noticed (same rule as the Next app).
 */
export const localeGuard: CanActivateFn = async (route) => {
  // inject() only works before the first await (injection context).
  const router = inject(Router);
  const i18n = inject(I18nService);
  const locale = route.paramMap.get('locale');
  if (!isLocale(locale)) {
    await i18n.use(i18n.preferredLocale());
    return router.parseUrl('/not-found');
  }
  await i18n.use(locale);
  return true;
};
