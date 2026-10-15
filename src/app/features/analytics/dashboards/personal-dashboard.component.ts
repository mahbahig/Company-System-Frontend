import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { AnalyticsApi } from '../analytics-api.service';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';
import { KpiGridComponent } from '../shared/kpi-grid.component';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/**
 * §11 personal workspace: only the queues the user's role works with — leads
 * and deals for sales, approvals for approvers, projects and milestones for
 * delivery and field roles, tasks for everyone — as returned by the server.
 */
@Component({
  selector: 'app-personal-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, StatCardComponent, KpiGridComponent],
  templateUrl: './personal-dashboard.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class PersonalDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.personal(params) });

  protected readonly kpiCodes = computed(() => {
    const codes = ['lead_to_qualified', 'contact_rate', 'first_response_time', 'sla_compliance', 'win_rate', 'average_sales_cycle'];
    return this.auth.can('financials.view') ? [...codes, 'pipeline_value', 'weighted_pipeline'] : codes;
  });

  /** Sales KPIs only reach lead / deal owners (the server sends none to other roles). */
  protected hasKpis(kpis: object): boolean {
    return Object.keys(kpis ?? {}).length > 0;
  }

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}
