import { Directive } from '@angular/core';

/** Card actions row: a quiet band separated from the content, actions aligned to the end. */
@Directive({
  selector: '[appCardFooter]',
  host: {
    'data-slot': 'card-footer',
    class: 'flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-border/70 bg-muted/30 px-6 py-4 sm:px-7',
  },
})
export class CardFooterDirective {}
