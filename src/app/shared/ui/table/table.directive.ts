import { Directive } from '@angular/core';

/** Data table (Next \`Table\`). */
@Directive({
  selector: 'table[appTable]',
  host: { class: 'w-full caption-bottom border-collapse text-sm' },
})
export class TableDirective {}
