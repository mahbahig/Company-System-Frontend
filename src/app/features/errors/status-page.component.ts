import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DecorComponent } from '../../shared/decor/decor.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';

/**
 * Centred message page used for 404 and 403: a small decor sculpture — an
 * object alone on an empty plinth, nothing broken — above the code and the
 * way back.
 */
@Component({
  selector: 'app-status-page',
  imports: [RouterLink, TranslatePipe, ButtonDirective, DecorComponent],
  template: `
    <div class="relative flex flex-col items-center animate-rise-in">
      <!-- Soft brand halo behind the piece; it is also the whole picture
           without WebGL. Centred, so it reads the same in LTR and RTL. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 m-auto size-56 rounded-full bg-primary/10 blur-3xl sm:size-64"
      ></div>
      @defer (on idle) {
        <app-decor
          composition="sculpture"
          class="status-decor relative h-48 w-72 sm:h-56 sm:w-80"
        />
      } @placeholder {
        <div aria-hidden="true" class="h-48 w-72 sm:h-56 sm:w-80"></div>
      }
      <p
        class="tabular relative -mt-2 text-[clamp(4rem,16vw,7.5rem)] font-bold leading-none tracking-tighter text-transparent bg-[linear-gradient(120deg,hsl(var(--primary)),hsl(var(--accent)))] bg-clip-text"
        dir="ltr"
      >
        {{ code() }}
      </p>
      <h1 class="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{{ titleKey() | t }}</h1>
      <p class="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{{ bodyKey() | t }}</p>
      <a appButton class="mt-8" [routerLink]="'/' + i18n.locale() + '/dashboard'">{{
        'errors.notFound.backToDashboard' | t
      }}</a>
    </div>
  `,
  styles: `
    /* A round vignette, so the square canvas never shows an edge. */
    .status-decor {
      mask-image: radial-gradient(closest-side, black 70%, transparent);
    }
  `,
  host: { class: 'flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center' },
})
export class StatusPageComponent {
  protected readonly i18n = inject(I18nService);

  readonly code = input.required<number>();
  readonly titleKey = input.required<string>();
  readonly bodyKey = input.required<string>();
}
