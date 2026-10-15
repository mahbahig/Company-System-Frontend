import { Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { I18nService } from '../../../core/i18n/i18n.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { AnalyticsApi } from '../analytics-api.service';
import type { AnalyticsFilter } from '../models/analytics-filter.interface';
import type { WorkloadRow } from '../models/dashboards.interface';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/** DASH-04 operational / PM dashboard: handoffs, visits, assessments, proposals, contracts, projects and resource workload. */
@Component({
  selector: 'app-operational-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, StatCardComponent, ...TABLE_IMPORTS],
  templateUrl: './operational-dashboard.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OperationalDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  protected readonly i18n = inject(I18nService);
  private readonly navigation = inject(NavigationService);

  readonly filter = input<AnalyticsFilter>({});

  protected readonly data = rxResource({ params: () => this.filter(), stream: ({ params }) => this.api.operational(params) });
  protected readonly cards: Array<{ key: string; path?: string; tone?: 'warning' | 'danger' | 'info' }> = [
    { key: 'pendingHandoffs', path: '/handoffs', tone: 'warning' },
    { key: 'upcomingVisits', path: '/visits' },
    { key: 'completedVisits', path: '/visits' },
    { key: 'pendingAssessments', path: '/assessments', tone: 'info' },
    { key: 'tpsInProgress', path: '/proposals', tone: 'info' },
    { key: 'fpsToPrepare', path: '/proposals', tone: 'warning' },
    { key: 'fpsInProgress', path: '/proposals' },
    { key: 'awaitingApproval', path: '/approvals', tone: 'warning' },
    { key: 'contractsPending', path: '/contracts', tone: 'info' },
    { key: 'activeProjects', path: '/projects' },
    { key: 'delayedProjects', path: '/projects', tone: 'danger' },
  ];

  protected name(row: WorkloadRow): string {
    return this.i18n.pick(row.fullNameAr, row.fullNameEn) || '—';
  }

  protected n(value: number | undefined): string {
    return this.i18n.formatNumber(value ?? 0);
  }

  /** A drill-down link only into an area the role can open (same rule as the route guard). */
  protected openable(path: string): string | undefined {
    return this.navigation.canOpen(path) ? this.link(path.split('?')[0]) : undefined;
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}
