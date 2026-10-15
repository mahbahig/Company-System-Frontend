import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronLeft, ChevronRight } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../ui/icon/icon.component';
import { pageWindow } from './page-window';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';

const LINK =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-2 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * "Showing x–y of z" + page links (current page and ±2, with ellipses).
 * Links keep the other query params; chevrons swap sides in Arabic.
 */
@Component({
  selector: 'app-pagination',
  imports: [TooltipDirective, RouterLink, TranslatePipe, IconComponent],
  templateUrl: './pagination.component.html',
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
