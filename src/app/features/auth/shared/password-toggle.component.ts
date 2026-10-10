import { Component, input, model } from '@angular/core';
import { Eye, EyeOff } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Show / hide toggle for a password `appAuthInput`, placed in the field's trailing slot. */
@Component({
  selector: 'app-password-toggle',
  imports: [IconComponent, TranslatePipe],
  template: `
    <button
      type="button"
      class="absolute end-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
      [attr.aria-label]="(shown() ? 'auth.login.hidePassword' : 'auth.login.showPassword') | t"
      [attr.aria-pressed]="shown()"
      [attr.aria-controls]="controls()"
      (click)="shown.set(!shown())"
    >
      <app-icon [icon]="shown() ? hideIcon : showIcon" svgClass="size-[1.05rem]" />
    </button>
  `,
})
export class PasswordToggleComponent {
  /** Id of the password input this button reveals. */
  readonly controls = input.required<string>();
  readonly shown = model(false);

  protected readonly showIcon = Eye;
  protected readonly hideIcon = EyeOff;
}
