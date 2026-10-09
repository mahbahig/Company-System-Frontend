import { Directive } from '@angular/core';

/** Card body (Next \`CardContent\`). */
@Directive({
  selector: '[appCardContent]',
  host: { class: 'block p-6 pt-0' },
})
export class CardContentDirective {}
