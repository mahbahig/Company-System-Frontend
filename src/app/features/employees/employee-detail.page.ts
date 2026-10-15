import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CalendarClock, ClipboardCheck, MapPin, PhoneCall, Target, UserRound, type IconNode } from 'lucide';

import { ApiError } from '../../core/api/api-error';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NavigationService } from '../../core/navigation/navigation.service';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { BreadcrumbsComponent } from '../../shared/crm/breadcrumbs/breadcrumbs.component';
import { TimelineTextService } from '../../shared/crm/timeline/timeline-text.service';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { DetailSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusPageComponent } from '../errors/status-page.component';
import { AdminApi, type EmployeePerformance } from '../admin/admin-api.service';

type Period = '30d' | '90d' | 'year' | 'all';
const PERIODS: Period[] = ['30d', '90d', 'year', 'all'];
const DAY = 86_400_000;

interface Metric {
  label: string;
  value: string;
  hint?: string;
}

interface MetricGroup {
  id: string;
  icon: IconNode;
  metrics: Metric[];
}

/**
 * `/employees/:id` — one employee's performance and activity (`users.view_performance`:
 * the CEO and the System Administrator for anyone, a Sales Manager for their own
 * Sales Representatives; the API refuses anyone else and nothing is shown):
 * leads handled, contact attempts, calls, meetings, visits, tasks, deals and their
 * recent actions — all from the operational records of THIS user, for the chosen
 * period (`?period=`; stock figures such as open leads are current). Won value is
 * shown only to financial viewers (the API omits it otherwise).
 */
@Component({
  selector: 'app-employee-detail-page',
  imports: [RouterLink, TranslatePipe, BreadcrumbsComponent, AlertComponent, BadgeComponent, IconComponent, DetailSkeletonComponent, StatusPageComponent, ...CARD_IMPORTS],
  templateUrl: './employee-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class EmployeeDetailPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly timelineText = inject(TimelineTextService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly id = input.required<string>();
  /** `30d` (default), `90d`, `year`, `all`. */
  readonly period = input<string>();

  protected readonly periods = PERIODS;
  protected readonly activePeriod = computed<Period>(() => (PERIODS.includes(this.period() as Period) ? (this.period() as Period) : '30d'));

  protected readonly data = rxResource({
    params: () => ({ id: this.id(), range: rangeOf(this.activePeriod()) }),
    stream: ({ params }) => this.api.performance(params.id, params.range),
  });
  protected readonly notFound = computed(() => {
    const error = this.data.error();
    return ApiError.is(error) && (error.status === 404 || error.status === 400);
  });
  protected readonly forbidden = computed(() => {
    const error = this.data.error();
    return ApiError.is(error) && error.status === 403;
  });
  protected readonly crumbs = computed(() => {
    const user = this.data.value()?.user;
    return [{ label: this.i18n.t('navigation.items.employees'), path: '/employees' }, { label: user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '' }];
  });

  protected readonly groups = computed<MetricGroup[]>(() => {
    const p = this.data.value();
    if (!p) return [];
    const n = (value: number) => this.i18n.formatNumber(value);
    const t = (key: string, params?: Record<string, string | number>) => this.i18n.t(`ux.performance.metrics.${key}`, params);
    const groups: MetricGroup[] = [
      {
        id: 'leads',
        icon: UserRound,
        metrics: [
          { label: t('leadsOwned'), value: n(p.leads.owned), hint: t('inPeriod') },
          { label: t('leadsOpen'), value: n(p.leads.open), hint: t('now') },
          { label: t('leadsConverted'), value: n(p.leads.converted) },
          { label: t('contactAttempts'), value: n(p.leads.contactAttempts), hint: t('reached', { count: n(p.leads.reachedAttempts) }) },
        ],
      },
      {
        id: 'calls',
        icon: PhoneCall,
        metrics: [
          { label: t('callsTotal'), value: n(p.calls.total) },
          { label: t('callsOutbound'), value: n(p.calls.outbound), hint: t('inbound', { count: n(p.calls.inbound) }) },
          { label: t('talkTime'), value: this.i18n.formatNumber(p.calls.durationSeconds / 3600, { maximumFractionDigits: 1 }), hint: t('hours') },
          { label: t('avgCall'), value: p.calls.total ? this.i18n.formatNumber(p.calls.durationSeconds / 60 / p.calls.total, { maximumFractionDigits: 1 }) : '—', hint: t('minutes') },
        ],
      },
      {
        id: 'meetings',
        icon: CalendarClock,
        metrics: [
          { label: t('meetingsTotal'), value: n(p.meetings.total) },
          { label: t('meetingsCompleted'), value: n(p.meetings.completed) },
          { label: t('meetingsUpcoming'), value: n(p.meetings.upcoming), hint: t('now') },
        ],
      },
      {
        id: 'visits',
        icon: MapPin,
        metrics: [
          { label: t('visitsTotal'), value: n(p.visits.total) },
          { label: t('visitsCompleted'), value: n(p.visits.completed) },
        ],
      },
      {
        id: 'tasks',
        icon: ClipboardCheck,
        metrics: [
          { label: t('tasksOpen'), value: n(p.tasks.open), hint: t('now') },
          { label: t('tasksOverdue'), value: n(p.tasks.overdue), hint: t('now') },
          { label: t('tasksCompleted'), value: n(p.tasks.completed) },
        ],
      },
      {
        id: 'deals',
        icon: Target,
        metrics: [
          { label: t('dealsOpen'), value: n(p.opportunities.open), hint: t('now') },
          { label: t('dealsWon'), value: n(p.opportunities.won) },
          { label: t('dealsLost'), value: n(p.opportunities.lost) },
          ...(p.opportunities.wonValue !== undefined ? [{ label: t('wonValue'), value: this.i18n.formatMoneyCompact(p.opportunities.wonValue) }] : []),
        ],
      },
    ];
    return groups;
  });

  constructor() {
    void this.reference.load();
  }

  protected selectPeriod(period: Period): void {
    void this.router.navigate([], { queryParams: { period: period === '30d' ? null : period }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected initial(p: EmployeePerformance): string {
    return Array.from(this.i18n.pick(p.user.fullNameAr, p.user.fullNameEn).trim())[0]?.toUpperCase() ?? '?';
  }

  protected describe(event: EmployeePerformance['recentActivity'][number]): string {
    return this.timelineText.describe({ type: event.type, data: event.data });
  }

  /** The record an action concerns, linked only where this user can open it. */
  protected recordLink(event: EmployeePerformance['recentActivity'][number]): { commands: string[]; label: string } | null {
    const candidates: Array<[string | null, string, string]> = [
      [event.opportunityId, 'opportunities', 'ux.performance.openOpportunity'],
      [event.leadId, 'leads', 'ux.performance.openLead'],
      [event.customerId, 'customers', 'ux.performance.openCustomer'],
    ];
    for (const [id, area, label] of candidates) {
      if (id && this.navigation.canOpen(`/${area}/${id}`)) return { commands: ['/', this.i18n.locale(), area, id], label };
    }
    return null;
  }
}

/** A period → `{from, to}` ISO strings (none for all time). */
function rangeOf(period: Period): { from?: string } {
  const now = Date.now();
  if (period === 'all') return {};
  if (period === 'year') return { from: new Date(new Date().getFullYear(), 0, 1).toISOString() };
  return { from: new Date(now - (period === '30d' ? 30 : 90) * DAY).toISOString() };
}
