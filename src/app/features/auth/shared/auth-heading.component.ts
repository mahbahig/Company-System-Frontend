import { Component, input } from '@angular/core';
import type { IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Eyebrow, page title (the screen's `<h1>`) and lead line, shared by every
 * sign-in screen. Tracking is applied to Latin script only — letter-spacing
 * breaks the joins of Arabic letters.
 *
 * The title input is `heading`, not `title`: a static `title="…"` would also
 * stay on the host element as the native attribute, and the browser would
 * show the raw i18n key as a hover tooltip.
 */
@Component({
  selector: 'app-auth-heading',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './auth-heading.component.html',
  host: { class: 'block animate-fade-in-up' },
})
export class AuthHeadingComponent {
  readonly icon = input.required<IconNode>();
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly lead = input<string | null>(null);
}
