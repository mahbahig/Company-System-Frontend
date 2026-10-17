import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { ApiService } from '../../../core/api/api.service';
import type { Page } from '../../../core/api/page.interface';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { userName } from '../../../shared/utils/display-name';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';

type Ref = { id: string; customerNo?: string; nameAr?: string; nameEn?: string; primaryContactName?: string; fullNameAr?: string; fullNameEn?: string } | string | null | undefined;

interface OwnershipRequest {
  id: string;
  type: 'transfer' | 'collaboration';
  customerId: Ref;
  requesterId: Ref;
  currentOwnerId?: Ref;
  reason: string;
  crossTeam: boolean;
  status: string;
  approvalId?: string | null;
  decisionComment?: string | null;
  createdAt: string;
}

/**
 * OWN-03/04 collaboration and transfer requests: what I asked for, what was
 * asked about my customers, and (for deciders) everything in scope. Decisions
 * are taken in the approval inbox.
 */
@Component({
  selector: 'app-ownership-requests-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, PaginationComponent, TabsComponent, ...TABLE_IMPORTS],
  templateUrl: './ownership-requests.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OwnershipRequestsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly box = input<string>();
  /** Exceptions Center / Data Quality: only `pending` requests. */
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly tabs = computed(() => [
    ...(this.auth.can('ownership.request') ? [{ id: 'mine', label: this.i18n.t('admin.ownership.mine') }] : []),
    { id: 'on_my_customers', label: this.i18n.t('admin.ownership.onMine') },
    ...(this.auth.can('ownership.decide') ? [{ id: 'all', label: this.i18n.t('admin.ownership.all') }] : []),
  ]);
  protected readonly activeBox = computed(() => this.box() ?? this.tabs()[0]?.id ?? 'on_my_customers');
  protected readonly data = rxResource({ params: () => ({ box: this.activeBox(), status: this.status(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.get<Page<OwnershipRequest>>('ownership/requests', params) });
  protected readonly rows = computed(() => (this.data.hasValue() ? this.data.value().rows : []));

  protected pickBox(box: string): void {
    void this.router.navigate([], { queryParams: { box, page: null }, queryParamsHandling: 'merge' });
  }

  protected customer(ref: Ref): string {
    if (!ref || typeof ref === 'string') return '—';
    return this.i18n.pick(ref.nameAr, ref.nameEn) || ref.primaryContactName || ref.customerNo || '—';
  }

  protected person(ref: Ref): string {
    return userName((ar, en) => this.i18n.pick(ar, en), ref as Parameters<typeof userName>[1]);
  }

  protected cancel(id: string): void {
    void this.actions.run(this.api.post(`ownership/requests/${id}/cancel`), 'act.cancelled', () => this.data.reload());
  }
}
