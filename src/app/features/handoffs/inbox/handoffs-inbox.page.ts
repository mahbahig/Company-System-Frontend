import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { userName } from '../../../shared/utils/display-name';
import { HandoffsApi, type Handoff, type HandoffOpportunityRef } from '../handoffs-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

/** §11.3 PM / Technical Lead handoff inbox (Accept / Return / Clarify), with SLA highlighting (HAND-08). */
@Component({
  selector: 'app-handoffs-inbox-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, TabsComponent, PaginationComponent, ...TABLE_IMPORTS, PageSizeSelectComponent],
  templateUrl: './handoffs-inbox.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class HandoffsInboxPage {
  private readonly api = inject(HandoffsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly view = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly tabs: TabItem[] = ['pending', 'mine', 'overdue', 'all'].map((id) => ({ id, label: this.i18n.t(`handoffs.views.${id}`) }));
  protected readonly activeView = computed(() => (['pending', 'mine', 'overdue', 'all'].includes(this.view() ?? '') ? (this.view() as string) : 'pending'));

  protected readonly result = rxResource({
    params: () => ({ all: this.activeView() === 'all' || undefined, mine: this.activeView() === 'mine' || undefined, overdue: this.activeView() === 'overdue' || undefined, page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.inbox(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));

  protected select(view: string): void {
    void this.router.navigate([], { queryParams: { view: view === 'pending' ? null : view, page: null }, queryParamsHandling: 'merge' });
  }

  protected opp(row: Handoff): HandoffOpportunityRef | null {
    return typeof row.opportunityId === 'object' ? row.opportunityId : null;
  }

  protected customer(row: Handoff): string {
    const customer = this.opp(row)?.customerId;
    return customer && typeof customer === 'object' ? this.i18n.pick(customer.nameAr, customer.nameEn) : '—';
  }

  protected name(value: Handoff['submittedBy']): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }

  protected late(row: Handoff): boolean {
    return !!row.slaDueAt && ['submitted', 'under_review', 'resubmitted', 'clarification_requested'].includes(row.status) && new Date(row.slaDueAt).getTime() < Date.now();
  }
}
