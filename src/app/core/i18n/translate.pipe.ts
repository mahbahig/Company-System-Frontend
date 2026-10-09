import { Pipe, inject, type PipeTransform } from '@angular/core';

import { I18nService } from './i18n.service';

/**
 * `{{ 'auth.login.title' | t }}` / `{{ 'crm.pagination.showing' | t: { from, to, total } }}`.
 *
 * Impure on purpose: the output depends on the active-locale signal, not only
 * on the arguments. The lookup is a few property reads, so re-running it on
 * each check is cheaper than caching.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string | null | undefined, params?: Record<string, string | number | null | undefined>): string {
    return key ? this.i18n.t(key, params) : '';
  }
}
