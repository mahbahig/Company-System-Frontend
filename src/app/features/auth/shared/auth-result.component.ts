import { Component, input } from '@angular/core';
import type { IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Completed-step panel (reset e-mail sent, password changed): a glowing badge, the message and a projected action. */
@Component({
  selector: 'app-auth-result',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './auth-result.component.html',
  host: { class: 'flex flex-col items-center text-center animate-scale-in' },
})
export class AuthResultComponent {
  readonly icon = input.required<IconNode>();
  /** Translation key. */
  readonly message = input.required<string>();
}
