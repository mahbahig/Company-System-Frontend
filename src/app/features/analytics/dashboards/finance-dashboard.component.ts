import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { BarListComponent } from '../../../shared/crm/bar-list/bar-list.component';
import type { BarListItem } from '../../../shared/crm/bar-list/bar-list-item.interface';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { AnalyticsApi } from '../analytics-api.service';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';
import { formatKpi } from '../shared/kpi-format';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** DASH-05 finance dashboard: approvals, discount distribution, margins, contract values and the payment schedule. */
@Component({
  selector: 'app-finance-dashboard',
  imports: [DashboardSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (kpi of d.kpis; track kpi.code) {
          @if (['win_rate', 'average_deal_size', 'revenue', 'pipeline_value'].includes(kpi.code)) {
            <div class="rounded-lg border border-border bg-card p-4">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ 'kpi.label.' + kpi.code | t }}</p>
              <p class="tabular mt-1 text-2xl font-semibold" dir="ltr">{{ format(kpi) }}</p>
            </div>
          }
        }
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section appCard aria-labelledby="fin-approvals-heading">
          <div appCardHeader><h2 appCardTitle id="fin-approvals-heading">{{ 'analytics.finance.approvals' | t }}</h2></div>
          <div appCardContent>
            <ul class="divide-y divide-border">
              @for (row of d.approvals; track row.type) {
                <li class="flex items-center justify-between py-2 text-sm">
                  <span>{{ row.type | enum: 'approvalType' }}</span>
                  <span class="tabular">{{ n(row.pending) }} @if (row.overdue) {<span class="ms-2 text-destructive">({{ 'analytics.finance.overdue' | t: { count: row.overdue } }})</span>}</span>
                </li>
              } @empty {
                <li class="py-4 text-center text-sm text-muted-foreground">{{ 'analytics.finance.noApprovals' | t }}</li>
              }
            </ul>
          </div>
        </section>
        <section appCard aria-labelledby="discount-heading">
          <div appCardHeader><h2 appCardTitle id="discount-heading">{{ 'analytics.finance.discounts' | t }}</h2></div>
          <div appCardContent><app-bar-list [items]="discounts()" [emptyText]="'analytics.empty' | t" /></div>
        </section>
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="margins-heading">
        <h2 id="margins-heading" class="text-lg font-semibold">{{ 'analytics.finance.margins' | t }}</h2>
        <app-table-wrapper [label]="'analytics.finance.margins' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'analytics.finance.proposal' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.opportunity' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.status' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.listPrice' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.discount' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.finalPrice' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.cost' | t }}</th>
                <th appTableHead>{{ 'analytics.finance.margin' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.margins; track $index) {
                <tr appTableRow [appRowLink]="row.id ? ['/', i18n.locale(), 'proposals', 'financial', row.id] : null">
                  <td appTableCell class="tabular whitespace-nowrap" dir="ltr">
                    @if (row.id) {
                      <a class="text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'proposals', 'financial', row.id]">{{ row.number }} v{{ row.versionNo }}</a>
                    } @else {
                      {{ row.number }} v{{ row.versionNo }}
                    }
                  </td>
                  <td appTableCell>{{ row.opportunityName ?? '—' }}</td>
                  <td appTableCell><app-status-badge enum="financialProposalStatus" [value]="row.status" /></td>
                  <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.listPrice) }}</td>
                  <td appTableCell class="tabular">{{ n(row.discountPct) }}%</td>
                  <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.finalPrice) }}</td>
                  <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.totalCost) }}</td>
                  <td appTableCell class="tabular" [class.text-destructive]="row.marginPct < 15">{{ n(row.marginPct) }}%</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="8">{{ 'analytics.empty' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <section appCard aria-labelledby="contract-values-heading">
          <div appCardHeader><h2 appCardTitle id="contract-values-heading">{{ 'analytics.finance.contractValues' | t }}</h2></div>
          <div appCardContent><app-bar-list [items]="contracts()" [emptyText]="'analytics.empty' | t" /></div>
        </section>
        <section appCard aria-labelledby="schedule-heading">
          <div appCardHeader><h2 appCardTitle id="schedule-heading">{{ 'analytics.finance.paymentSchedule' | t }}</h2></div>
          <div appCardContent class="flex flex-col gap-4">
            @if (d.payments) {
              <dl class="grid grid-cols-3 gap-3 text-sm">
                <div><dt class="text-muted-foreground">{{ 'analytics.finance.totalScheduled' | t }}</dt><dd class="tabular font-semibold" dir="ltr">{{ i18n.formatMoney(d.payments.total) }}</dd></div>
                <div><dt class="text-muted-foreground">{{ 'analytics.finance.collected' | t }}</dt><dd class="tabular font-semibold text-success" dir="ltr">{{ i18n.formatMoney(d.payments.collected) }}</dd></div>
                <div><dt class="text-muted-foreground">{{ 'analytics.finance.outstanding' | t }}</dt><dd class="tabular font-semibold" dir="ltr">{{ i18n.formatMoney(d.payments.outstanding) }}</dd></div>
              </dl>
            }
            <app-table-wrapper [label]="'analytics.finance.paymentSchedule' | t">
              <table appTable>
                <thead appTableHeader>
                  <tr appTableRow>
                    <th appTableHead>{{ 'analytics.executive.month' | t }}</th>
                    <th appTableHead>{{ 'analytics.finance.due' | t }}</th>
                    <th appTableHead>{{ 'analytics.finance.paid' | t }}</th>
                  </tr>
                </thead>
                <tbody appTableBody>
                  @for (row of d.paymentSchedule; track row.month) {
                    <tr appTableRow>
                      <td appTableCell class="tabular" dir="ltr">{{ row.month === 'unscheduled' ? ('analytics.finance.unscheduled' | t) : row.month }}</td>
                      <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.due) }}</td>
                      <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.paid) }}</td>
                    </tr>
                  } @empty {
                    <tr app-table-empty [colSpan]="3">{{ 'analytics.empty' | t }}</tr>
                  }
                </tbody>
              </table>
            </app-table-wrapper>
          </div>
        </section>
      </div>
    } @else if (data.isLoading()) {
      <app-dashboard-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class FinanceDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.finance(params) });
  protected readonly discounts = computed<BarListItem[]>(() =>
    (this.data.value()?.discountDistribution ?? []).map((row) => ({ label: this.bucket(row.bucket), value: row.count, display: `${this.n(row.count)} · ${this.i18n.formatMoneyCompact(row.value)}` })),
  );
  protected readonly contracts = computed<BarListItem[]>(() =>
    (this.data.value()?.contractValues ?? []).map((row) => ({ label: this.i18n.t(`enums.contractStatus.${row.status}`), value: row.value, display: this.i18n.formatMoneyCompact(row.value), note: this.n(row.count) })),
  );

  protected format(kpi: Parameters<typeof formatKpi>[1]): string {
    return formatKpi(this.i18n, kpi);
  }

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }

  private bucket(value: number | string): string {
    const ranges: Record<string, string> = { '0': '0%', '0.0001': '0–5%', '5': '5–10%', '10': '10–15%', '15': '15–20%', '20': '≥ 20%' };
    return ranges[String(value)] ?? this.i18n.t('analytics.finance.other');
  }
}
