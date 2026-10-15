import { Component, booleanAttribute, input } from '@angular/core';
import { CircleAlert, type IconNode } from 'lucide';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Label, leading icon and message slots around a projected `appAuthInput`
 * (plus an optional trailing control such as a password toggle). The input
 * keeps its own bindings; point its `aria-describedby` at `<fieldId>-error`
 * or `<fieldId>-hint`, the ids this component renders. Keys, not text, go in.
 */
@Component({
  selector: 'app-auth-field',
  imports: [LabelComponent, IconComponent, TranslatePipe],
  templateUrl: './auth-field.component.html',
  host: { class: 'block' },
})
export class AuthFieldComponent {
  /** The projected input's `id`; also prefixes the message ids. */
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly icon = input<IconNode>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });

  protected readonly errorIcon = CircleAlert;
}
