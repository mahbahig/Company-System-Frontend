import { Component, input } from '@angular/core';

import type { LocalPager } from './local-pager';
import { PaginationComponent } from './pagination.component';

/**
 * The pagination footer for a list paged in memory (`LocalPager`): the same
 * controls as every other table, bound to the pager.
 * `<app-pager [pager]="contactsPager" />`
 */
@Component({
  selector: 'app-pager',
  imports: [PaginationComponent],
  template: `<app-pagination
    mode="state"
    [page]="pager().currentPage()"
    [pageCount]="pager().pageCount()"
    [total]="pager().total()"
    [pageSize]="pager().pageSize()"
    (pageChange)="pager().setPage($event)"
    (pageSizeChange)="pager().setPageSize($event)"
  />`,
})
export class PagerComponent {
  readonly pager = input.required<LocalPager<unknown>>();
}
