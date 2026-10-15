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
  templateUrl: './status-page.component.html',
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
