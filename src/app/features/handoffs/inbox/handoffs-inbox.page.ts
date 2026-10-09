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

/** §11.3 PM / Technical Lead handoff inbox (Accept / Return / Clarify), with SLA highlighting (HAND-08). */
@Component({
  selector: 'app-handoffs-inbox-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, TabsComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'handoffs.inboxTitle' | t" [subtitle]="'handoffs.inboxSubtitle' | t" class="!mb-0" />
    <app-tabs [tabs]="tabs" [active]="activeView()" (activeChange)="select($event)" [label]="'handoffs.inboxTitle' | t" />

    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'handoffs.inboxTitle' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'handoffs.columns.number' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.opportunity' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.customer' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.submittedBy' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.status' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.submitted' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.slaDue' | t }}</th>
            <th appTableHead>{{ 'handoffs.columns.resubmissions' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap font-medium">
                @if (opp(row); as o) {
                  <a [routerLink]="['/', i18n.locale(), 'opportunities', o.id, 'handoff']" class="text-primary hover:underline" dir="ltr">{{ row.handoffNo }}</a>
                }
              </td>
              <td appTableCell>{{ opp(row)?.name }} <span class="block text-xs text-muted-foreground tabular" dir="ltr">{{ opp(row)?.opportunityNo }}</span></td>
              <td appTableCell>{{ customer(row) }}</td>
              <td appTableCell class="whitespace-nowrap">{{ name(row.submittedBy) }}</td>
              <td appTableCell><app-status-badge enum="handoffStatus" [value]="row.status" /></td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.submittedAt, true) }}</td>
              <td appTableCell class="tabular whitespace-nowrap" [class.font-semibold]="late(row)" [class.text-destructive]="late(row)">{{ i18n.formatDate(row.slaDueAt, true) || '—' }}</td>
              <td appTableCell class="tabular text-center">{{ row.resubmissionCount }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="8">{{ (result.isLoading() ? 'common.labels.loading' : 'handoffs.inboxEmpty') | t }}</tr>
          }
        </tbody>
      </table>
    </app-table-wrapper>
    @if (result.hasValue()) {
      <app-pagination [page]="result.value().page" [pageCount]="result.value().pageCount" [total]="result.value().total" [pageSize]="result.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class HandoffsInboxPage {
  private readonly api = inject(HandoffsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly view = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly tabs: TabItem[] = ['pending', 'mine', 'overdue', 'all'].map((id) => ({ id, label: this.i18n.t(`handoffs.views.${id}`) }));
  protected readonly activeView = computed(() => (['pending', 'mine', 'overdue', 'all'].includes(this.view() ?? '') ? (this.view() as string) : 'pending'));

  protected readonly result = rxResource({
    params: () => ({ all: this.activeView() === 'all' || undefined, mine: this.activeView() === 'mine' || undefined, overdue: this.activeView() === 'overdue' || undefined, page: this.page() }),
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
