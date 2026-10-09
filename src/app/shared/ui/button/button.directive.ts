import { Directive, booleanAttribute, computed, input } from '@angular/core';

import { buttonVariants, type ButtonSize, type ButtonVariant } from './button-variants';

/**
 * `<button appButton variant="outline" size="sm">` or `<a appButton routerLink=…>`.
 * An attribute directive (not a wrapper component) so the native element keeps
 * its own semantics, form behaviour and keyboard handling.
 */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: { '[class]': 'classes()' },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');
  readonly fullWidth = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    buttonVariants({ variant: this.variant(), size: this.size(), fullWidth: this.fullWidth() }),
  );
}
