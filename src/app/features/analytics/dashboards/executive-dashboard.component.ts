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
  templateUrl: './executive-dashboard.component.html',
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
