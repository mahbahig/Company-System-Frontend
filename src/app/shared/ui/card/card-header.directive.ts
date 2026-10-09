import { Directive } from '@angular/core';

/** Card header block (Next \`CardHeader\`). */
@Directive({
  selector: '[appCardHeader]',
  host: { class: 'flex flex-col gap-1.5 p-6' },
})
export class CardHeaderDirective {}
