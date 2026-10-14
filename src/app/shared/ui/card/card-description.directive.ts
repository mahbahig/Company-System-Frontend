import { Directive } from '@angular/core';

/** Muted card subtitle under the title. */
@Directive({
  selector: '[appCardDescription]',
  host: { class: 'text-sm leading-relaxed text-muted-foreground' },
})
export class CardDescriptionDirective {}
