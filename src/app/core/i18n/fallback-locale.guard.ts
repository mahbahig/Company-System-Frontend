import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';

import { I18nService } from './i18n.service';
import { isLocale } from './locale';

/**
 * For routes outside `/:locale` (the 404 page): loads the language named by
 * the URL's first segment, else the user's last language, so the page is
 * translated even on a cold deep link.
 */
export const fallbackLocaleGuard: CanActivateFn = async (_route, state) => {
  const i18n = inject(I18nService);
  const first = state.url.split(/[/?#]/)[1];
  await i18n.use(isLocale(first) ? first : i18n.preferredLocale());
  return true;
};
