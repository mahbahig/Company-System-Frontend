import { Directive } from '@angular/core';

/** Table body with row dividers (Next \`TableBody\`). */
@Directive({
  selector: 'tbody[appTableBody]',
  host: { class: 'divide-y divide-border' },
})
export class TableBodyDirective {}
