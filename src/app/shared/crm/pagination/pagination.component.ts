import { Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChevronLeft, ChevronRight } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../ui/icon/icon.component';
import { pageWindow } from './page-window';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from './page-size';

const CONTROL =
  'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-border px-2.5 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const DISABLED = ' pointer-events-none opacity-40';
const CURRENT = ' border-primary bg-primary text-primary-foreground hover:bg-primary';

/**
 * The one pagination footer every table uses, centred under the table:
 * [Previous] [1] … [5] [6] [7] … [20] [Next], then "Showing 21–40 of 243" and
 * "Items per page" (10 / 20 / 50 / 100). The current page is marked for
 * screen readers (`aria-current`) and not by colour alone (it is a filled,
 * bordered control); on a phone the numbers give way to "Page 6 of 20".
 *
 * - `mode="url"` (default): page and size live in the address
 *   (`?page=&pageSize=`), so refresh, back / forward and shared links keep
 *   them; the other query params (search, filters, sort) are kept.
 * - `mode="state"`: emits `pageChange` / `pageSizeChange` for a table whose
 *   state lives in its component (`PagerState`, `LocalPager`).
 *
 * While `loading`, the controls are disabled (no double requests). A page
 * left empty — the last row of the last page deleted, a stale `?page=` — moves
 * to the last page that exists.
 */
@Component({
  selector: 'app-pagination',
  imports: [RouterLink, TranslatePipe, IconComponent],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input(false);
  readonly mode = input<'url' | 'state'>('url');
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly control = CONTROL;
  protected readonly disabledClass = DISABLED;
  protected readonly currentClass = CURRENT;
  protected readonly lastPage = computed(() => Math.max(1, this.pageCount()));
  protected readonly firstRow = computed(() => (this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0));
  protected readonly lastRow = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  protected readonly pages = computed(() => pageWindow(this.page(), this.lastPage()));
  protected readonly previousIcon = computed(() => (this.i18n.isRtl() ? ChevronRight : ChevronLeft));
  protected readonly nextIcon = computed(() => (this.i18n.isRtl() ? ChevronLeft : ChevronRight));
  protected readonly sizes = computed(() => (this.pageSizeOptions().includes(this.pageSize()) ? this.pageSizeOptions() : [...this.pageSizeOptions(), this.pageSize()].sort((a, b) => a - b)));
  protected readonly selectId = `page-size-${Math.random().toString(36).slice(2, 9)}`;

  constructor() {
    // A page past the end (its last row was deleted, or a stale link): go to the last page that has rows.
    effect(() => {
      const page = this.page();
      const last = this.lastPage();
      if (!this.loading() && page > last) untracked(() => this.go(last, true));
    });
  }

  /** Page 1 and the default size are the bare URL (no `?page=1`, no `?pageSize=20`). */
  protected pageParam(page: number): number | null {
    return page > 1 ? page : null;
  }

  protected go(page: number, replaceUrl = false): void {
    if (this.loading() && !replaceUrl) return;
    if (this.mode() === 'state') {
      this.pageChange.emit(page);
      return;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page: this.pageParam(page) }, queryParamsHandling: 'merge', replaceUrl });
  }

  /** A new page size starts from the first page (keeping search, filters and sort). */
  protected changeSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!size || size === this.pageSize()) return;
    this.pageSizeChange.emit(size);
    if (this.mode() === 'state') return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pageSize: size === DEFAULT_PAGE_SIZE ? null : size, page: null }, queryParamsHandling: 'merge' });
  }
}
