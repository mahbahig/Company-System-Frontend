import { Directive } from '@angular/core';

/** Hoverable table row (Next \`TableRow\`). */
@Directive({
  selector: 'tr[appTableRow]',
  host: { class: 'transition-colors hover:bg-muted/40' },
})
export class TableRowDirective {}
