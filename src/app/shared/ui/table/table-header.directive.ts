import { Directive } from '@angular/core';

/** Table head section (Next \`TableHeader\`). */
@Directive({
  selector: 'thead[appTableHeader]',
  host: { class: 'bg-muted/50' },
})
export class TableHeaderDirective {}
