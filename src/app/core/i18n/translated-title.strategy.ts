import { Service, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

import { I18nService } from './i18n.service';

/**
 * Route `title` values are i18n keys; the document title becomes
 * "<page> · EcoTech CRM" in the active language (Next metadata template).
 */
@Service()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const app = this.i18n.t('app.name');
    this.title.setTitle(key ? `${this.i18n.t(key)} · ${app}` : app);
  }
}
