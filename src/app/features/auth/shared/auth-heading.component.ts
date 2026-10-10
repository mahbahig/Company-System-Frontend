import { Component, input } from '@angular/core';
import type { IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Eyebrow, page title (the screen's `<h1>`) and lead line, shared by every
 * sign-in screen. Tracking is applied to Latin script only — letter-spacing
 * breaks the joins of Arabic letters.
 */
@Component({
  selector: 'app-auth-heading',
  imports: [IconComponent, TranslatePipe],
  template: `
    <p
      class="flex items-center gap-2 text-xs font-semibold uppercase text-primary ltr:tracking-[0.16em]"
    >
      <app-icon [icon]="icon()" svgClass="size-3.5" />{{ eyebrow() | t }}
    </p>
    <h1
      class="mt-3 text-[1.75rem] font-semibold leading-tight text-balance text-foreground ltr:tracking-[-0.022em] sm:text-[2rem]"
    >
      {{ title() | t }}
    </h1>
    @if (lead(); as lead) {
      <p class="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{{ lead | t }}</p>
    }
  `,
  host: { class: 'block animate-fade-in-up' },
})
export class AuthHeadingComponent {
  readonly icon = input.required<IconNode>();
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input<string | null>(null);
}
