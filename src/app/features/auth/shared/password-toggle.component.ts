import { Component, input, model } from '@angular/core';
import { Eye, EyeOff } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Show / hide toggle for a password `appAuthInput`, placed in the field's trailing slot. */
@Component({
  selector: 'app-password-toggle',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './password-toggle.component.html',
})
export class PasswordToggleComponent {
  /** Id of the password input this button reveals. */
  readonly controls = input.required<string>();
  readonly shown = model(false);

  protected readonly showIcon = Eye;
  protected readonly hideIcon = EyeOff;
}
