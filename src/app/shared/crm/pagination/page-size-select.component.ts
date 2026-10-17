import { Component, computed, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { LocalPager } from './local-pager';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from './page-size';

/**
 * "Items per page" (10 / 20 / 50 / 100), placed ABOVE its table — the page
 * navigation stays in the footer (`<app-pagination>`). Every paged table
 * puts it right before its `<app-table-wrapper>`, aligned to the end.
 *
 * - `mode="url"` (default): the size lives in the address (`?pageSize=`); a
 *   new size starts from page 1 and keeps search, filters and sort.
 * - `mode="state"`: emits `pageSizeChange` for a table whose state lives in its
 *   component (`PagerState`; a `LocalPager` uses `<app-pager-size>`).
 *
 * Hidden while the table is known to be empty (`total` 0); disabled while a page loads.
 */
@Component({
  selector: 'app-page-size',
  imports: [TranslatePipe],
  template: `
    <label class="flex items-center gap-2 text-sm text-muted-foreground" [for]="selectId">
      {{ 'crm.pagination.perPage' | t }}
      <select
        [id]="selectId"
        class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        data-testid="pagination-size"
        [disabled]="loading()"
        [value]="pageSize()"
        (change)="changeSize($event)"
      >
        @for (size of sizes(); track size) {
          <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
        }
      </select>
    </label>
  `,
  host: {
    class: 'flex items-center justify-end',
    'data-testid': 'page-size',
    '[style.display]': "total() === 0 ? 'none' : null",
  },
})
export class PageSizeSelectComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = input.required<number>();
  /** Rows across all pages; null while unknown (first load). */
  readonly total = input<number | null>(null);
  readonly loading = input(false);
  readonly mode = input<'url' | 'state'>('url');
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);
  readonly pageSizeChange = output<number>();

  protected readonly sizes = computed(() => (this.pageSizeOptions().includes(this.pageSize()) ? this.pageSizeOptions() : [...this.pageSizeOptions(), this.pageSize()].sort((a, b) => a - b)));
  protected readonly selectId = `page-size-${Math.random().toString(36).slice(2, 9)}`;

  /** A new page size starts from the first page (keeping search, filters and sort). */
  protected changeSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!size || size === this.pageSize()) return;
    this.pageSizeChange.emit(size);
    if (this.mode() === 'state') return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pageSize: size === DEFAULT_PAGE_SIZE ? null : size, page: null }, queryParamsHandling: 'merge' });
  }
}

/**
 * "Items per page" for a list paged in memory (`LocalPager`), above its table.
 * `<app-pager-size [pager]="contactsPager" />` — the footer is `<app-pager>`.
 */
@Component({
  selector: 'app-pager-size',
  imports: [PageSizeSelectComponent],
  template: `<app-page-size mode="state" [pageSize]="pager().pageSize()" [total]="pager().total()" (pageSizeChange)="pager().setPageSize($event)" />`,
  host: { class: 'block', '[style.display]': "pager().total() === 0 ? 'none' : null" },
})
export class PagerSizeComponent {
  readonly pager = input.required<LocalPager<unknown>>();
}
