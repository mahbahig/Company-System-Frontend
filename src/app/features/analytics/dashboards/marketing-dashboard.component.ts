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
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';

/** DASH-03 / MKT-01..04 marketing dashboard with first-touch campaign attribution. */
@Component({
  selector: 'app-marketing-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, KpiGridComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS, PagerComponent],
  templateUrl: './marketing-dashboard.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class MarketingDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.marketing(params) });
  /** Campaign results, paged in memory. */
  protected readonly campaignsPager = new LocalPager(() => this.data.value()?.campaigns);
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
