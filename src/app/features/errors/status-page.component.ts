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
    <div class="relative flex flex-col items-center animate-rise-in">
      <!-- Soft brand halo behind the numeral; centred symmetrically so it reads
           the same in LTR and RTL. -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 m-auto size-64 rounded-full bg-primary/10 blur-3xl"></div>
      <p
        class="tabular relative text-[clamp(4.5rem,20vw,10rem)] font-bold leading-none tracking-tighter text-transparent [background:linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] bg-clip-text"
        dir="ltr"
      >
        {{ code() }}
      </p>
      <h1 class="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{{ titleKey() | t }}</h1>
      <p class="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{{ bodyKey() | t }}</p>
      <a appButton class="mt-8" [routerLink]="'/' + i18n.locale() + '/dashboard'">{{ 'errors.notFound.backToDashboard' | t }}</a>
    </div>
  `,
  host: { class: 'flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center' },
})
export class StatusPageComponent {
  protected readonly i18n = inject(I18nService);

  readonly code = input.required<number>();
  readonly titleKey = input.required<string>();
  readonly bodyKey = input.required<string>();
}
