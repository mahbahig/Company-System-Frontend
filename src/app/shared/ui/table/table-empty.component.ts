import { Component, input } from '@angular/core';

/** Empty-state row: `<tr app-table-empty [colSpan]="5">No customers yet</tr>`. */
@Component({
  selector: 'tr[app-table-empty]',
  templateUrl: './table-empty.component.html',
  host: { class: 'transition-colors hover:bg-transparent' },
})
export class TableEmptyComponent {
  readonly colSpan = input.required<number>();
}
