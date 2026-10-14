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
  template: `
    <app-page-header [heading]="'admin.ownership.title' | t" [subtitle]="'admin.ownership.subtitle' | t" class="!mb-0" />
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }
    <app-tabs [tabs]="tabs()" [active]="activeBox()" (activeChange)="pickBox($event)" [label]="'admin.ownership.title' | t" />
    <app-table-wrapper [label]="'admin.ownership.title' | t" [attr.aria-busy]="data.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'admin.automation.when' | t }}</th>
            <th appTableHead>{{ 'admin.ownership.type' | t }}</th>
            <th appTableHead>{{ 'act.fields.customer' | t }}</th>
            <th appTableHead>{{ 'admin.ownership.requester' | t }}</th>
            <th appTableHead>{{ 'admin.ownership.owner' | t }}</th>
            <th appTableHead>{{ 'handoffs.reason' | t }}</th>
            <th appTableHead>{{ 'admin.users.status' | t }}</th>
            <th appTableHead><span class="sr-only">{{ 'admin.actions' | t }}</span></th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (r of rows(); track r.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(r.createdAt, true) }}</td>
              <td appTableCell>{{ r.type | enum: 'ownershipRequestType' }}</td>
              <td appTableCell>{{ customer(r.customerId) }}</td>
              <td appTableCell>{{ person(r.requesterId) }}</td>
              <td appTableCell>{{ person(r.currentOwnerId) }}</td>
              <td appTableCell class="max-w-xs truncate" [attr.title]="r.reason">{{ r.reason }}</td>
              <td appTableCell><app-status-badge enum="ownershipRequestStatus" [value]="r.status" /></td>
              <td appTableCell>
                <div class="flex gap-1">
                  @if (r.approvalId && r.status === 'pending' && auth.can('approvals.view')) {
                    <a appButton variant="outline" size="sm" [routerLink]="['/', i18n.locale(), 'approvals', r.approvalId]">{{ 'admin.ownership.openApproval' | t }}</a>
                  }
                  @if (r.status === 'pending' && activeBox() === 'mine') {
                    <button type="button" appButton variant="ghost" size="sm" [disabled]="actions.busy()" (click)="cancel(r.id)">{{ 'act.cancel' | t }}</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            @if (data.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="8" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="8">{{ 'admin.empty' | t }}</tr>
            }
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (data.hasValue()) {
      <app-pagination [page]="data.value().page" [pageCount]="data.value().pageCount" [total]="data.value().total" [pageSize]="data.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class OwnershipRequestsPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly box = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly tabs = computed(() => [
    ...(this.auth.can('ownership.request') ? [{ id: 'mine', label: this.i18n.t('admin.ownership.mine') }] : []),
    { id: 'on_my_customers', label: this.i18n.t('admin.ownership.onMine') },
    ...(this.auth.can('ownership.decide') ? [{ id: 'all', label: this.i18n.t('admin.ownership.all') }] : []),
  ]);
  protected readonly activeBox = computed(() => this.box() ?? this.tabs()[0]?.id ?? 'on_my_customers');
  protected readonly data = rxResource({ params: () => ({ box: this.activeBox(), page: this.page() }), stream: ({ params }) => this.api.get<Page<OwnershipRequest>>('ownership/requests', params) });
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
