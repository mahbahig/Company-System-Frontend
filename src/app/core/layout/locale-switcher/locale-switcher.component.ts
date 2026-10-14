import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Languages } from 'lucide';

import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18nService } from '../../i18n/i18n.service';
import { LOCALES, LOCALE_NAMES } from '../../i18n/locale';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';

/**
 * Switches to the OTHER language, keeping the current page and query:
 * `/ar/leads?page=2` → `/en/leads?page=2`. The button shows the target
 * language in its own script.
 */
@Component({
  selector: 'app-locale-switcher',
  imports: [TooltipDirective, ButtonDirective, IconComponent],
  template: `
    <button type="button" appButton variant="ghost" size="sm" class="gap-2 px-2 sm:px-3" [attr.aria-label]="label()" [attr.lang]="target()" [appTooltip]="label()" appTooltipSide="bottom" (click)="switch()">
      <app-icon [icon]="languages" />
      <span class="hidden sm:inline">{{ targetName() }}</span>
    </button>
  `,
})
export class LocaleSwitcherComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly languages = Languages;
  protected readonly target = computed(() => LOCALES.find((locale) => locale !== this.i18n.locale()) ?? this.i18n.locale());
  protected readonly targetName = computed(() => LOCALE_NAMES[this.target()]);
  protected readonly label = computed(() => `${this.i18n.t('common.labels.language')}: ${this.targetName()}`);

  protected switch(): void {
    const url = this.router.url.replace(/^\/(ar|en)(?=\/|\?|$)/, `/${this.target()}`);
    void this.router.navigateByUrl(url);
  }
}
