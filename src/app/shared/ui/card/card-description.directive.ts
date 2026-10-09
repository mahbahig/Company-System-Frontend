import { Directive } from '@angular/core';

/** Muted card subtitle (Next \`CardDescription\`). */
@Directive({
  selector: '[appCardDescription]',
  host: { class: 'text-sm text-muted-foreground' },
})
export class CardDescriptionDirective {}
