import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ExecutiveDashboardComponent } from '../analytics/dashboards/executive-dashboard.component';
import type { AnalyticsFilter } from '../analytics/models/analytics-filter.interface';
import { AnalyticsFilterBarComponent } from '../analytics/shared/analytics-filter-bar.component';

/** `/dashboard/executive` (E5): company-wide KPIs; the route is gated by `dashboards.view_executive`. */
@Component({
  selector: 'app-executive-dashboard-page',
  imports: [TranslatePipe, PageHeaderComponent, AnalyticsFilterBarComponent, ExecutiveDashboardComponent],
  template: `
    <app-page-header [heading]="'analytics.tabs.executive' | t" [subtitle]="'analytics.executive.subtitle' | t" class="!mb-0" />
    <app-analytics-filter-bar [filter]="filter()" />
    <app-executive-dashboard [filter]="filter()" />
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ExecutiveDashboardPage {
  readonly from = input<string>();
  readonly to = input<string>();
  readonly ownerId = input<string>();
  readonly sourceCode = input<string>();
  readonly campaignCode = input<string>();
  readonly governorateCode = input<string>();
  readonly solutionTypeCode = input<string>();

  protected readonly filter = computed<AnalyticsFilter>(() => ({
    from: this.from(),
    to: this.to(),
    ownerId: this.ownerId(),
    sourceCode: this.sourceCode(),
    campaignCode: this.campaignCode(),
    governorateCode: this.governorateCode(),
    solutionTypeCode: this.solutionTypeCode(),
  }));
}
