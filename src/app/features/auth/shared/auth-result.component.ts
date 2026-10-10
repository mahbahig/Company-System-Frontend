import { Component, input } from '@angular/core';
import type { IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Completed-step panel (reset e-mail sent, password changed): a glowing badge, the message and a projected action. */
@Component({
  selector: 'app-auth-result',
  imports: [IconComponent, TranslatePipe],
  template: `
    <span
      aria-hidden="true"
      class="relative flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success-tint ring-1 ring-success/20"
    >
      <span class="absolute inset-0 rounded-2xl bg-success/25 blur-xl"></span>
      <app-icon [icon]="icon()" svgClass="relative size-6" />
    </span>
    <p role="status" class="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
      {{ message() | t }}
    </p>
    <div class="mt-8 w-full"><ng-content /></div>
  `,
  host: { class: 'flex flex-col items-center text-center animate-scale-in' },
})
export class AuthResultComponent {
  readonly icon = input.required<IconNode>();
  /** Translation key. */
  readonly message = input.required<string>();
}
