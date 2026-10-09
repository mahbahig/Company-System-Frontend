import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronLeft, ChevronRight } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../ui/icon/icon.component';
import { pageWindow } from './page-window';

const LINK =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * "Showing x–y of z" + page links (current page and ±2, with ellipses).
 * Links keep the other query params; chevrons swap sides in Arabic.
 */
@Component({
  selector: 'app-pagination',
  imports: [RouterLink, TranslatePipe, IconComponent],
  template: `
    @if (total() > 0) {
      <nav [attr.aria-label]="'crm.pagination.label' | t" class="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
        <p class="text-sm text-muted-foreground">{{ 'crm.pagination.showing' | t: { from: firstRow(), to: lastRow(), total: total() } }}</p>

        @if (pageCount() > 1) {
          <ul class="flex items-center gap-1">
            <li>
              @if (page() > 1) {
                <a [routerLink]="[]" [queryParams]="{ page: pageParam(page() - 1) }" queryParamsHandling="merge" [class]="link" [attr.aria-label]="'crm.pagination.previous' | t">
                  <app-icon [icon]="previousIcon()" />
                </a>
              } @else {
                <span [class]="link + ' pointer-events-none opacity-40'" aria-hidden="true"><app-icon [icon]="previousIcon()" /></span>
              }
            </li>
            @for (candidate of pages(); track $index) {
              @if (candidate === null) {
                <li aria-hidden="true" class="px-1 text-muted-foreground">…</li>
              } @else {
                <li>
                  <a
                    [routerLink]="[]"
                    [queryParams]="{ page: pageParam(candidate) }"
                    queryParamsHandling="merge"
                    [attr.aria-current]="candidate === page() ? 'page' : null"
                    [attr.aria-label]="'crm.pagination.goToPage' | t: { page: candidate }"
                    [class]="link + ' tabular' + (candidate === page() ? ' border-primary bg-primary text-primary-foreground' : '')"
                  >
                    {{ candidate }}
                  </a>
                </li>
              }
            }
            <li>
              @if (page() < pageCount()) {
                <a [routerLink]="[]" [queryParams]="{ page: pageParam(page() + 1) }" queryParamsHandling="merge" [class]="link" [attr.aria-label]="'crm.pagination.next' | t">
                  <app-icon [icon]="nextIcon()" />
                </a>
              } @else {
                <span [class]="link + ' pointer-events-none opacity-40'" aria-hidden="true"><app-icon [icon]="nextIcon()" /></span>
              }
            </li>
          </ul>
        }
      </nav>
    }
  `,
})
export class PaginationComponent {
  private readonly i18n = inject(I18nService);

  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();

  protected readonly link = LINK;
  protected readonly firstRow = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly lastRow = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  protected readonly pages = computed(() => pageWindow(this.page(), this.pageCount()));
  protected readonly previousIcon = computed(() => (this.i18n.isRtl() ? ChevronRight : ChevronLeft));
  protected readonly nextIcon = computed(() => (this.i18n.isRtl() ? ChevronLeft : ChevronRight));

  /** Page 1 is the bare URL (no `?page=1`). */
  protected pageParam(page: number): number | null {
    return page > 1 ? page : null;
  }
}
