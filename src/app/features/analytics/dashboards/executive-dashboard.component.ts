import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { BarListComponent } from '../../../shared/crm/bar-list/bar-list.component';
import type { BarListItem } from '../../../shared/crm/bar-list/bar-list-item.interface';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { AnalyticsApi } from '../analytics-api.service';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';
import { KpiGridComponent } from '../shared/kpi-grid.component';
import { percent } from '../shared/kpi-format';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** DASH-01 executive dashboard. */
@Component({
  selector: 'app-executive-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, StatCardComponent, KpiGridComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <app-kpi-grid [kpis]="d.kpis" [codes]="kpiCodes()" />

      <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <app-stat-card [label]="'analytics.executive.proposals' | t" [value]="n(d.counts['proposals'])" />
        <app-stat-card [label]="'analytics.executive.negotiations' | t" [value]="n(d.counts['negotiations'])" />
        <app-stat-card [label]="'analytics.executive.contracts' | t" [value]="n(d.counts['contracts'])" [link]="openable('/contracts')" />
        <app-stat-card [label]="'analytics.executive.pendingApprovals' | t" [value]="n(d.counts['pendingApprovals'])" [tone]="d.counts['pendingApprovals'] ? 'warning' : 'neutral'" [link]="openable('/approvals')" />
        <app-stat-card [label]="'analytics.executive.stagnant' | t" [value]="n(d.counts['stagnant'])" [tone]="d.counts['stagnant'] ? 'danger' : 'neutral'" [link]="openable('/exceptions')" />
        <app-stat-card [label]="'analytics.executive.visits' | t" [value]="n(d.counts['siteVisitsCompleted'])" [hint]="'analytics.executive.upcoming' | t: { count: d.counts['siteVisitsUpcoming'] }" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section appCard aria-labelledby="funnel-heading">
          <div appCardHeader><h2 appCardTitle id="funnel-heading">{{ 'analytics.executive.funnel' | t }}</h2></div>
          <div appCardContent>
            <app-bar-list [items]="funnel()" [label]="'analytics.executive.funnel' | t" [emptyText]="'analytics.empty' | t" />
          </div>
        </section>
        <section appCard aria-labelledby="projects-heading">
          <div appCardHeader><h2 appCardTitle id="projects-heading">{{ 'analytics.executive.projects' | t }}</h2></div>
          <div appCardContent class="flex flex-col gap-4">
            <div class="grid grid-cols-3 gap-3 text-center">
              <div><p class="tabular text-2xl font-semibold">{{ n(d.projects.active) }}</p><p class="text-xs text-muted-foreground">{{ 'analytics.executive.activeProjects' | t }}</p></div>
              <div><p class="tabular text-2xl font-semibold text-destructive">{{ n(d.projects.delayed) }}</p><p class="text-xs text-muted-foreground">{{ 'analytics.executive.delayedProjects' | t }}</p></div>
              <div><p class="tabular text-2xl font-semibold">{{ pct(d.projects.averageProgress === null ? null : d.projects.averageProgress / 100) }}</p><p class="text-xs text-muted-foreground">{{ 'analytics.executive.avgProgress' | t }}</p></div>
            </div>
            <app-bar-list [items]="projectBars()" [emptyText]="'analytics.empty' | t" />
          </div>
        </section>
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="trend-heading">
        <h2 id="trend-heading" class="text-lg font-semibold">{{ 'analytics.executive.trend' | t }}</h2>
        <app-table-wrapper [label]="'analytics.executive.trend' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'analytics.executive.month' | t }}</th>
                <th appTableHead>{{ 'analytics.executive.leadsCreated' | t }}</th>
                <th appTableHead>{{ 'analytics.executive.wonDeals' | t }}</th>
                @if (money()) {
                  <th appTableHead>{{ 'analytics.executive.wonValue' | t }}</th>
                }
              </tr>
            </thead>
            <tbody appTableBody>
              @for (row of d.trend; track row.month) {
                <tr appTableRow>
                  <td appTableCell class="tabular" dir="ltr">{{ row.month }}</td>
                  <td appTableCell class="tabular">{{ n(row.leads) }}</td>
                  <td appTableCell class="tabular">{{ n(row.won) }}</td>
                  @if (money()) {
                    <td appTableCell class="tabular">{{ i18n.formatMoney(row.wonValue) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
      </section>
    } @else if (data.isLoading()) {
      <app-dashboard-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ExecutiveDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);
  private readonly navigation = inject(NavigationService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.executive(params) });
  protected readonly money = computed(() => this.auth.can('financials.view'));

  protected readonly kpiCodes = computed(() => {
    const base = ['total_leads', 'qualified_leads', 'lead_to_qualified', 'lead_to_customer', 'active_opportunities', 'won_deals', 'win_rate', 'average_sales_cycle', 'proposal_to_win', 'handoff_first_pass', 'proposal_turnaround', 'enrichment_completion'];
    return this.money() ? [...base, 'pipeline_value', 'weighted_pipeline', 'revenue', 'average_deal_size'] : base;
  });

  protected readonly funnel = computed<BarListItem[]>(() =>
    (this.data.value()?.funnel ?? []).map((row) => ({
      label: this.reference.label('pipeline_stage', row.stage),
      value: row.count,
      display: this.money() ? `${this.i18n.formatNumber(row.count)} · ${this.i18n.formatMoneyCompact(row.value)}` : this.i18n.formatNumber(row.count),
    })),
  );

  protected readonly projectBars = computed<BarListItem[]>(() =>
    (this.data.value()?.projects.byStatus ?? []).map((row) => ({ label: this.i18n.t(`enums.projectStatus.${row.status}`), value: row.count })),
  );

  constructor() {
    void this.reference.load();
  }

  protected n(value: number | undefined): string {
    return this.i18n.formatNumber(value ?? 0);
  }

  protected pct(value: number | null): string {
    return percent(this.i18n, value);
  }

  /** A drill-down link only into an area the role can open (same rule as the route guard). */
  protected openable(path: string): string | undefined {
    return this.navigation.canOpen(path) ? this.link(path.split('?')[0]) : undefined;
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}
