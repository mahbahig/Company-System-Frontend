import { computed, signal, type Signal } from '@angular/core';

import { DEFAULT_PAGE_SIZE } from './page-size';

/**
 * Pages a list that is already complete in memory — a record's own bounded
 * sub-list that arrives with its detail (a project's milestones, a proposal's
 * versions) or a small configuration collection loaded whole for pickers
 * (teams, roles, reference items). Same controls as every other table
 * (`<app-pagination mode="state">`); collections that grow with the business
 * are paged by the API instead. A page left empty by a deletion falls back to
 * the last page that has rows.
 *
 * `pager = new LocalPager(() => this.items())`, then iterate `pager.rows()`.
 */
export class LocalPager<T> {
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly total: Signal<number>;
  readonly pageCount: Signal<number>;
  /** The current page, never past the last one. */
  readonly currentPage: Signal<number>;
  readonly rows: Signal<T[]>;

  constructor(source: () => readonly T[] | null | undefined) {
    const all = computed(() => source() ?? []);
    this.total = computed(() => all().length);
    this.pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
    this.currentPage = computed(() => Math.min(this.page(), this.pageCount()));
    this.rows = computed(() => {
      const start = (this.currentPage() - 1) * this.pageSize();
      return all().slice(start, start + this.pageSize());
    });
  }

  setPage(page: number): void {
    this.page.set(Math.max(1, page));
  }

  /** A new page size starts again from the first page. */
  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  /** Back to the first page (after a search or a filter changed). */
  reset(): void {
    this.page.set(1);
  }
}

/**
 * Page / page-size state of a server-paged table whose state lives in the
 * component rather than the address (several tables on one page, a table in
 * a section of a record's page). Feed `page()` and `pageSize()` into the
 * resource's params; a new page size, search or filter goes back to page 1.
 */
export class PagerState {
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  setPage(page: number): void {
    this.page.set(Math.max(1, page));
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  reset(): void {
    this.page.set(1);
  }
}
