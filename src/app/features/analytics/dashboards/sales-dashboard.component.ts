import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { BarListComponent } from '../../../shared/crm/bar-list/bar-list.component';
import type { BarListItem } from '../../../shared/crm/bar-list/bar-list-item.interface';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { AnalyticsApi } from '../analytics-api.service';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';
import type { SalesRepRow } from '../models/dashboards.interface';
import { KpiGridComponent } from '../shared/kpi-grid.component';
import { percent } from '../shared/kpi-format';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** DASH-02 sales dashboard: team KPIs and per-rep performance (self-sourced vs assigned, contact, qualification, pipeline, follow-ups, enrichment). */
@Component({
  selector: 'app-sales-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, KpiGridComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <app-kpi-grid [kpis]="d.kpis" [codes]="kpiCodes()" />

      <section class="flex flex-col gap-3" aria-labelledby="reps-heading">
        <h2 id="reps-heading" class="text-lg font-semibold">{{ 'analytics.sales.byRep' | t }}</h2>
        <app-table-wrapper [label]="'analytics.sales.byRep' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'analytics.sales.rep' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.leads' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.selfSourced' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.contactRate' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.qualificationRate' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.openOpps' | t }}</th>
                @if (money()) {
                  <th appTableHead>{{ 'analytics.sales.pipeline' | t }}</th>
                }
                <th appTableHead>{{ 'analytics.sales.wonLost' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.winRate' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.cycle' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.followUps' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.overdue' | t }}</th>
                <th appTableHead>{{ 'analytics.sales.enrichment' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (rep of d.reps; track rep.userId) {
                <tr appTableRow>
                  <td appTableCell class="font-medium whitespace-nowrap">{{ name(rep) }}</td>
                  <td appTableCell class="tabular">{{ n(rep.leads) }}</td>
                  <td appTableCell class="tabular">{{ n(rep.selfSourced) }} / {{ n(rep.assigned) }}</td>
                  <td appTableCell class="tabular">{{ pct(rep.contactRate) }}</td>
                  <td appTableCell class="tabular">{{ pct(rep.qualificationRate) }}</td>
                  <td appTableCell class="tabular">{{ n(rep.openOpportunities) }}</td>
                  @if (money()) {
                    <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoneyCompact(rep.pipelineValue) }}</td>
                  }
                  <td appTableCell class="tabular">{{ n(rep.won) }} / {{ n(rep.lost) }}</td>
                  <td appTableCell class="tabular">{{ pct(rep.winRate) }}</td>
                  <td appTableCell class="tabular">{{ rep.salesCycleDays === null ? '—' : n(rep.salesCycleDays) }}</td>
                  <td appTableCell class="tabular">{{ pct(rep.followUpPerformance) }}</td>
                  <td appTableCell class="tabular" [class.text-destructive]="rep.overdueActivities > 0">{{ n(rep.overdueActivities) }}</td>
                  <td appTableCell class="tabular">{{ pct(rep.enrichmentCompletion) }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="13">{{ 'analytics.empty' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <section appCard aria-labelledby="sales-funnel-heading">
        <div appCardHeader><h2 appCardTitle id="sales-funnel-heading">{{ 'analytics.executive.funnel' | t }}</h2></div>
        <div appCardContent><app-bar-list [items]="funnel()" [emptyText]="'analytics.empty' | t" /></div>
      </section>
    } @else if (data.isLoading()) {
      <app-dashboard-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class SalesDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.sales(params) });
  protected readonly money = computed(() => this.auth.can('financials.view'));
  protected readonly kpiCodes = computed(() => {
    const base = ['total_leads', 'contact_rate', 'first_response_time', 'sla_compliance', 'lead_to_qualified', 'qualified_to_opportunity', 'lead_to_customer', 'enrichment_completion', 'win_rate', 'proposal_to_win', 'average_sales_cycle', 'proposal_versions_to_close'];
    return this.money() ? [...base, 'pipeline_value', 'weighted_pipeline', 'average_deal_size', 'average_discount'] : base;
  });
  protected readonly funnel = computed<BarListItem[]>(() =>
    (this.data.value()?.funnel ?? []).map((row) => ({ label: this.reference.label('pipeline_stage', row.stage), value: row.count, display: this.money() ? `${this.n(row.count)} · ${this.i18n.formatMoneyCompact(row.value)}` : this.n(row.count) })),
  );

  constructor() {
    void this.reference.load();
  }

  protected name(rep: SalesRepRow): string {
    return this.i18n.pick(rep.fullNameAr, rep.fullNameEn) || '—';
  }

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }

  protected pct(value: number | null): string {
    return percent(this.i18n, value);
  }
}
