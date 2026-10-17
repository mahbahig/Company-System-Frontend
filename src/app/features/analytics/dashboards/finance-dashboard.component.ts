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
import { LocalPager } from '../../../shared/crm/pagination/local-pager';
import { PagerComponent } from '../../../shared/crm/pagination/pager.component';
import { PagerSizeComponent } from '../../../shared/crm/pagination/page-size-select.component';

/** DASH-05 finance dashboard: approvals, discount distribution, margins, contract values and the payment schedule. */
@Component({
  selector: 'app-finance-dashboard',
  imports: [DashboardSkeletonComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, BarListComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS, PagerComponent, PagerSizeComponent],
  templateUrl: './finance-dashboard.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class FinanceDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.finance(params) });
  /** The payment schedule by month, paged in memory. */
  protected readonly schedulePager = new LocalPager(() => this.data.value()?.paymentSchedule);
  /** Margins, paged in memory. */
  protected readonly marginsPager = new LocalPager(() => this.data.value()?.margins);
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
