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
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';

/** DASH-02 sales dashboard: team KPIs and per-rep performance (self-sourced vs assigned, contact, qualification, pipeline, follow-ups, enrichment). */
@Component({
  selector: 'app-sales-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, KpiGridComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS, PagerComponent],
  templateUrl: './sales-dashboard.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SalesDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.sales(params) });
  /** Results by representative, paged in memory (one row per person in scope). */
  protected readonly repsPager = new LocalPager(() => this.data.value()?.reps);
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
