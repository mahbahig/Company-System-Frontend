import { Component, computed, input } from '@angular/core';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type IconNode } from 'lucide';

import type { AlertVariant } from '../../../shared/ui/alert/alert-variants';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

const TONES: Record<AlertVariant, string> = {
  default: 'border-border bg-muted/70 text-foreground [&_svg]:text-primary',
  info: 'border-primary/20 bg-primary/[0.06] text-foreground [&_svg]:text-primary',
  success: 'border-success/25 bg-success/[0.08] text-success-tint',
  warning: 'border-warning/30 bg-warning/[0.08] text-warning-tint',
  destructive: 'border-destructive/25 bg-destructive/[0.07] text-destructive-tint',
};

const ICONS: Record<AlertVariant, IconNode> = {
  default: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
};

/**
 * Inline message for the sign-in screens, in the same variants as `app-alert`.
 * Errors are announced at once (`role="alert"`), everything else politely.
 */
@Component({
  selector: 'app-auth-notice',
  imports: [IconComponent],
  templateUrl: './auth-notice.component.html',
  host: {
    '[class]': 'classes()',
    '[attr.role]': "urgent() ? 'alert' : 'status'",
    '[attr.aria-live]': "urgent() ? 'assertive' : 'polite'",
  },
})
export class AuthNoticeComponent {
  readonly variant = input<AlertVariant>('default');

  protected readonly urgent = computed(() => this.variant() === 'destructive');
  protected readonly icon = computed(() => ICONS[this.variant()]);
  protected readonly classes = computed(
    () =>
      `flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[this.variant()]}`,
  );
}
