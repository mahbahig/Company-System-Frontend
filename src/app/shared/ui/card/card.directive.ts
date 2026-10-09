import { Directive } from '@angular/core';

/** Card surface (Next \`Card\`). */
@Directive({
  selector: '[appCard]',
  host: { class: 'block rounded-lg border border-border bg-card text-card-foreground shadow-sm' },
})
export class CardDirective {}
