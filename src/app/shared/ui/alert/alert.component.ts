import { Component, computed, input } from '@angular/core';

import { alertVariants, type AlertVariant } from './alert-variants';

/**
 * Inline message. Destructive alerts are announced immediately
 * (`role="alert"`, assertive); the others politely (`role="status"`).
 */
@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  host: {
    '[class]': 'classes()',
    '[attr.role]': "urgent() ? 'alert' : 'status'",
    '[attr.aria-live]': "urgent() ? 'assertive' : 'polite'",
  },
})
export class AlertComponent {
  readonly variant = input<AlertVariant>('default');

  protected readonly urgent = computed(() => this.variant() === 'destructive');
  protected readonly classes = computed(() => alertVariants({ variant: this.variant() }));
}
