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

/** §11 personal workspace: the user's own queues (leads, tasks, approvals, visits) and personal KPIs. */
@Component({
  selector: 'app-personal-dashboard',
  imports: [TranslatePipe, AlertComponent, StatCardComponent, KpiGridComponent],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <section class="flex flex-col gap-3" aria-labelledby="my-work-heading">
        <h2 id="my-work-heading" class="text-lg font-semibold">{{ 'analytics.personal.myWork' | t }}</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          @if (auth.can('leads.view')) {
            <app-stat-card [label]="'analytics.personal.newLeads' | t" [value]="n(d.leads['new'] ?? 0)" [link]="link('/leads/mine')" [queryParams]="{ tab: 'new' }" />
            <app-stat-card [label]="'analytics.personal.followUpsDue' | t" [value]="n(d.followUpsDue)" [tone]="d.followUpsDue ? 'warning' : 'neutral'" [link]="link('/leads/mine')" [queryParams]="{ tab: 'follow_ups_due' }" />
          }
          <app-stat-card [label]="'analytics.personal.tasksToday' | t" [value]="n(d.tasks.today)" [link]="link('/tasks')" [queryParams]="{ view: 'today' }" />
          <app-stat-card [label]="'analytics.personal.tasksOverdue' | t" [value]="n(d.tasks.overdue)" [tone]="d.tasks.overdue ? 'danger' : 'neutral'" [link]="link('/tasks')" [queryParams]="{ view: 'overdue' }" />
          @if (auth.can('opportunities.view')) {
            <app-stat-card [label]="'analytics.personal.openOpportunities' | t" [value]="n(d.opportunities.open)" [link]="link('/opportunities')" />
            <app-stat-card [label]="'analytics.personal.withoutNextAction' | t" [value]="n(d.opportunities.withoutNextAction)" [tone]="d.opportunities.withoutNextAction ? 'warning' : 'neutral'" [link]="link('/opportunities')" />
          }
          @if (auth.can('approvals.decide')) {
            <app-stat-card [label]="'analytics.personal.approvals' | t" [value]="n(d.approvalsPending)" [tone]="d.approvalsPending ? 'info' : 'neutral'" [link]="link('/approvals')" />
          }
          @if (auth.can('visits.view')) {
            <app-stat-card [label]="'analytics.personal.upcomingVisits' | t" [value]="n(d.upcomingVisits)" [link]="link('/visits')" />
          }
        </div>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="my-kpis-heading">
        <h2 id="my-kpis-heading" class="text-lg font-semibold">{{ 'analytics.personal.myKpis' | t }}</h2>
        <app-kpi-grid [kpis]="d.kpis" [codes]="kpiCodes()" />
      </section>
    } @else if (data.isLoading()) {
      <p class="text-sm text-muted-foreground">{{ 'common.labels.loading' | t }}</p>
    }
  `,
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

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}
