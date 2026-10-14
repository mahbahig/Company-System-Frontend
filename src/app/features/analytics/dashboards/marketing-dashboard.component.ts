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
import type { CampaignRow } from '../models/dashboards.interface';
import { KpiGridComponent } from '../shared/kpi-grid.component';
import { percent } from '../shared/kpi-format';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** DASH-03 / MKT-01..04 marketing dashboard with first-touch campaign attribution. */
@Component({
  selector: 'app-marketing-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, KpiGridComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <p class="text-sm text-muted-foreground">{{ 'analytics.marketing.attribution' | t }}</p>
      <app-kpi-grid [kpis]="d.kpis" [codes]="kpiCodes()" />

      <section class="flex flex-col gap-3" aria-labelledby="campaigns-heading">
        <h2 id="campaigns-heading" class="text-lg font-semibold">{{ 'analytics.marketing.campaigns' | t }}</h2>
        <app-table-wrapper [label]="'analytics.marketing.campaigns' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'analytics.marketing.campaign' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.leads' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.qualified' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.opportunities' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.proposals' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.contracts' | t }}</th>
                <th appTableHead>{{ 'analytics.marketing.wonLost' | t }}</th>
                @if (money()) {
                  <th appTableHead>{{ 'analytics.marketing.spend' | t }}</th>
                  <th appTableHead>{{ 'analytics.marketing.costPerLead' | t }}</th>
                  <th appTableHead>{{ 'analytics.marketing.costPerWon' | t }}</th>
                  <th appTableHead>{{ 'analytics.marketing.revenue' | t }}</th>
                }
                <th appTableHead>{{ 'analytics.marketing.topLoss' | t }}</th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.campaigns; track row.code) {
                <tr appTableRow>
                  <td appTableCell class="font-medium">{{ i18n.pick(row.nameAr, row.nameEn) }}</td>
                  <td appTableCell class="tabular">{{ n(row.leads) }}</td>
                  <td appTableCell class="tabular">{{ n(row.qualified) }}</td>
                  <td appTableCell class="tabular">{{ n(row.opportunities) }}</td>
                  <td appTableCell class="tabular">{{ n(row.proposals) }}</td>
                  <td appTableCell class="tabular">{{ n(row.contracts) }}</td>
                  <td appTableCell class="tabular">{{ n(row.won) }} / {{ n(row.lost) }}</td>
                  @if (money()) {
                    <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.spend) }}</td>
                    <td appTableCell class="tabular whitespace-nowrap">{{ row.costPerLead === null ? '—' : i18n.formatMoney(row.costPerLead) }}</td>
                    <td appTableCell class="tabular whitespace-nowrap">{{ row.costPerWon === null ? '—' : i18n.formatMoney(row.costPerWon) }}</td>
                    <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.revenue) }}</td>
                  }
                  <td appTableCell>{{ topLoss(row) }}</td>
                </tr>
              } @empty {
                <tr app-table-empty [colSpan]="12">{{ 'analytics.empty' | t }}</tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <section appCard aria-labelledby="sources-heading">
          <div appCardHeader><h2 appCardTitle id="sources-heading">{{ 'analytics.marketing.bySource' | t }}</h2></div>
          <div appCardContent><app-bar-list [items]="sources()" [emptyText]="'analytics.empty' | t" /></div>
        </section>
        <section appCard aria-labelledby="quality-heading">
          <div appCardHeader><h2 appCardTitle id="quality-heading">{{ 'analytics.marketing.leadQuality' | t }}</h2></div>
          <div appCardContent><app-bar-list [items]="quality()" [emptyText]="'analytics.empty' | t" /></div>
        </section>
      </div>
    } @else if (data.isLoading()) {
      <app-dashboard-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class MarketingDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.marketing(params) });
  protected readonly money = computed(() => this.auth.can('financials.view'));
  protected readonly kpiCodes = computed(() => {
    const base = ['total_leads', 'qualified_leads', 'lead_to_qualified', 'qualified_to_opportunity', 'lead_to_customer', 'proposal_to_win'];
    return this.money() ? [...base, 'cost_per_lead', 'cost_per_won_deal', 'campaign_revenue'] : base;
  });
  protected readonly sources = computed<BarListItem[]>(() =>
    (this.data.value()?.sources ?? []).map((row) => ({ label: this.reference.label('lead_source', row.code), value: row.leads, display: `${this.n(row.leads)} · ${percent(this.i18n, row.qualifiedRate)}`, note: `${this.n(row.won)} ${this.i18n.t('analytics.marketing.wonShort')}` })),
  );
  protected readonly quality = computed<BarListItem[]>(() =>
    (this.data.value()?.leadQuality ?? []).map((row) => ({ label: row.code === 'unrated' ? this.i18n.t('analytics.marketing.unrated') : this.reference.label('lead_quality', row.code), value: row.count })),
  );

  constructor() {
    void this.reference.load();
  }

  protected topLoss(row: CampaignRow): string {
    const [code] = Object.entries(row.lossReasons).sort((a, b) => b[1] - a[1])[0] ?? [];
    return code ? this.reference.label('loss_reason', code) : '—';
  }

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }
}
