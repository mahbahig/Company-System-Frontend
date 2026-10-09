import { Directive } from '@angular/core';

/** Table data cell (Next \`TableCell\`). */
@Directive({
  selector: 'td[appTableCell]',
  host: { class: 'px-3 py-3 align-middle' },
})
export class TableCellDirective {}
