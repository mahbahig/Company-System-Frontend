import { Component, computed, input } from '@angular/core';

import { badgeVariants, type BadgeTone } from './badge-variants';

/** Status pill: `<app-badge tone="success">Won</app-badge>`. */
@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  host: { '[class]': 'classes()' },
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');

  protected readonly classes = computed(() => badgeVariants({ tone: this.tone() }));
}
