import { Component, input } from '@angular/core';

/** Empty-state row: `<tr app-table-empty [colSpan]="5">No customers yet</tr>`. */
@Component({
  selector: 'tr[app-table-empty]',
  template: `<td [attr.colspan]="colSpan()" class="px-3 py-12 text-center align-middle text-sm text-muted-foreground">
    <ng-content />
  </td>`,
  host: { class: 'transition-colors hover:bg-transparent' },
})
export class TableEmptyComponent {
  readonly colSpan = input.required<number>();
}
