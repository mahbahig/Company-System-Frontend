import { Directive } from '@angular/core';

/** Card surface (Next \`Card\`). */
@Directive({
  selector: '[appCard]',
  host: {
    // The transition is dormant on a static card but lets any consumer that
    // adds hover utilities (lift, shadow, border) move on the brand easing.
    class: 'block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color,transform] duration-200 ease-premium',
  },
})
export class CardDirective {}
