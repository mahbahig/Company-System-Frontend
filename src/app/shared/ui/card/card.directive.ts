import { Directive } from '@angular/core';

/**
 * Card surface: a quiet, intentional container — 12 px radius, hairline
 * border, soft two-layer elevation. Header / content / footer handle their own
 * padding, so any combination (content only, header + content, + footer)
 * sits with the same balanced inner spacing.
 */
@Directive({
  selector: '[appCard]',
  host: {
    'data-slot': 'card',
    // The transition is dormant on a static card but lets any consumer that
    // adds hover utilities (lift, shadow) move on the brand easing.
    class:
      'block rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color,transform,translate] duration-200 ease-premium',
  },
})
export class CardDirective {}
