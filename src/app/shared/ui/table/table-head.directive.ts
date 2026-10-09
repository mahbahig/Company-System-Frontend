import { Directive } from '@angular/core';

/** Column header cell; `scope="col"` so screen readers pair cells with headers. */
@Directive({
  selector: 'th[appTableHead]',
  host: {
    scope: 'col',
    class: 'h-11 px-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  },
})
export class TableHeadDirective {}
