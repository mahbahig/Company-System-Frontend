import { Component, booleanAttribute, input } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * `<label appLabel for="email" required>`. The asterisk is decorative; the
 * screen-reader text says "(required)" so it is never read as "asterisk".
 */
@Component({
  selector: 'label[appLabel]',
  imports: [TranslatePipe],
  template: `<ng-content />
    @if (required()) {
      <span aria-hidden="true" class="ms-1 text-destructive">*</span>
      <span class="sr-only"> ({{ 'common.labels.required' | t }})</span>
    }`,
  host: { 'data-slot': 'label', class: 'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60' },
})
export class LabelComponent {
  readonly required = input(false, { transform: booleanAttribute });
}
