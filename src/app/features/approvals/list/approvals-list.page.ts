import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { userName } from '../../../shared/utils/display-name';
import { ApprovalsApi, type Approval } from '../approvals-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';

const TYPES = ['discount', 'margin_floor', 'payment_terms', 'financial_proposal', 'combined_proposal_release', 'contract_value', 'ownership_transfer', 'ownership_collaboration', 'gate_override', 'expired_proposal_resend', 'customer_merge'];
const STATUSES = ['pending', 'approved', 'rejected', 'returned', 'expired', 'escalated'];

/** APPR-03 approval inbox: waiting for me (incl. delegated), requested by me, decided by me, all in scope. */
@Component({
  selector: 'app-approvals-list-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, TabsComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  templateUrl: './approvals-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ApprovalsListPage {
  private readonly api = inject(ApprovalsApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  readonly box = input<string>();
  readonly status = input<string>();
  readonly type = input<string>();
  /** Exceptions Center: still waiting for a decision (pending or escalated). */
  readonly open = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly activeBox = computed(() => (['inbox', 'requested', 'decided', 'all'].includes(this.box() ?? '') ? (this.box() as string) : 'inbox'));
  protected readonly counts = rxResource({ stream: () => this.api.counts() });
  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'inbox', label: this.i18n.t('approvals.boxes.inbox'), count: this.counts.value()?.total ?? null },
    { id: 'requested', label: this.i18n.t('approvals.boxes.requested') },
    { id: 'decided', label: this.i18n.t('approvals.boxes.decided') },
    { id: 'all', label: this.i18n.t('approvals.boxes.all') },
  ]);

  protected readonly result = rxResource({
    params: () => ({ box: this.activeBox(), status: this.status(), open: this.open() === '1' || undefined, type: this.type(), page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));

  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'type', label: this.i18n.t('approvals.columns.type'), options: TYPES.map((value) => ({ value, label: this.i18n.t(`enums.approvalType.${value}`) })), value: this.type() ?? '' },
    { name: 'status', label: this.i18n.t('approvals.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.approvalStatus.${value}`) })), value: this.status() ?? '' },
  ]);

  protected selectBox(box: string): void {
    void this.router.navigate([], { queryParams: { box: box === 'inbox' ? null : box, page: null }, queryParamsHandling: 'merge' });
  }

  protected requester(row: Approval): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.requesterId);
  }

  protected userLabel(ref: Approval['onBehalfOf']): string {
    return userName((ar, en) => this.i18n.pick(ar, en), ref ?? null);
  }

  protected isOverdue(row: Approval): boolean {
    return ['pending', 'escalated'].includes(row.status) && new Date(row.dueAt).getTime() < Date.now();
  }
}
