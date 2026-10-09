import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../shared/ui/button/button.directive';

/** Centred message page used for 404 and 403. */
@Component({
  selector: 'app-status-page',
  imports: [RouterLink, TranslatePipe, ButtonDirective],
  template: `
    <p class="tabular text-sm font-semibold text-primary" dir="ltr">{{ code() }}</p>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ titleKey() | t }}</h1>
    <p class="mt-2 max-w-md text-sm text-muted-foreground">{{ bodyKey() | t }}</p>
    <a appButton class="mt-6" [routerLink]="'/' + i18n.locale() + '/dashboard'">{{ 'errors.notFound.backToDashboard' | t }}</a>
  `,
  host: { class: 'flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center' },
})
export class StatusPageComponent {
  protected readonly i18n = inject(I18nService);

  readonly code = input.required<number>();
  readonly titleKey = input.required<string>();
  readonly bodyKey = input.required<string>();
}
