import { Directive } from '@angular/core';

/** Card footer actions row (Next \`CardFooter\`). */
@Directive({
  selector: '[appCardFooter]',
  host: { class: 'flex items-center gap-2 p-6 pt-0' },
})
export class CardFooterDirective {}
