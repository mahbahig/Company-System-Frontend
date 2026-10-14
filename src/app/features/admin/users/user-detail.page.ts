import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CalendarClock, ClipboardCheck, MapPin, PhoneCall, Target, UserRound, type IconNode } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import { BreadcrumbsComponent } from '../../../shared/crm/breadcrumbs/breadcrumbs.component';
import { TimelineTextService } from '../../../shared/crm/timeline/timeline-text.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { DetailSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { StatusPageComponent } from '../../errors/status-page.component';
import { AdminApi, type EmployeePerformance } from '../admin-api.service';

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
 * One employee's performance and activity (CEO oversight, `users.view_performance`):
 * leads handled, contact attempts, calls, meetings, visits, tasks, deals and their
 * recent actions — all from the operational records of THIS user, for the chosen
 * period (`?period=`; stock figures such as open leads are current). Won value is
 * shown only to financial viewers (the API omits it otherwise).
 */
@Component({
  selector: 'app-user-detail-page',
  imports: [RouterLink, TranslatePipe, BreadcrumbsComponent, AlertComponent, BadgeComponent, IconComponent, DetailSkeletonComponent, StatusPageComponent, ...CARD_IMPORTS],
  template: `
    @if (notFound()) {
      <app-status-page [code]="404" titleKey="errors.notFound.title" bodyKey="errors.notFound.body" />
    } @else if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    } @else if (data.value(); as p) {
      <app-breadcrumbs [items]="crumbs()" />

      <header class="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div class="flex min-w-0 items-center gap-4">
          <span class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-sm" aria-hidden="true">{{ initial(p) }}</span>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight">{{ i18n.pick(p.user.fullNameAr, p.user.fullNameEn) }}</h1>
            <p class="truncate text-sm text-muted-foreground" dir="ltr">{{ p.user.email }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (role of p.user.roleCodes; track role) {
                <app-badge tone="info">{{ 'enums.roleCode.' + role | t }}</app-badge>
              }
              <app-badge [tone]="p.user.isActive ? 'success' : 'danger'">{{ (p.user.isActive ? 'admin.active' : 'admin.inactive') | t }}</app-badge>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1 text-sm sm:items-end">
          <span class="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{{ 'admin.users.lastLogin' | t }}</span>
          <span class="tabular font-medium">{{ i18n.formatDate(p.user.lastLoginAt, true) || '—' }}</span>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold tracking-tight">{{ 'ux.performance.title' | t }}</h2>
        <div class="inline-flex rounded-lg border border-border bg-muted/40 p-1" role="radiogroup" [attr.aria-label]="'ux.performance.period' | t">
          @for (option of periods; track option) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="option === activePeriod()"
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [class.bg-card]="option === activePeriod()"
              [class.shadow-sm]="option === activePeriod()"
              [class.text-foreground]="option === activePeriod()"
              [class.text-muted-foreground]="option !== activePeriod()"
              (click)="selectPeriod(option)"
            >
              {{ 'ux.performance.periods.' + option | t }}
            </button>
          }
        </div>
      </div>

      @if (data.isLoading()) {
        <p class="sr-only" role="status">{{ 'common.labels.loading' | t }}</p>
      }
      <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" [class.opacity-60]="data.isLoading()" [attr.aria-busy]="data.isLoading()">
        @for (group of groups(); track group.id) {
          <section appCard [attr.aria-labelledby]="'perf-' + group.id">
            <div appCardHeader class="flex flex-row items-center gap-3">
              <span class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                <app-icon [icon]="group.icon" svgClass="size-4" />
              </span>
              <h3 appCardTitle [id]="'perf-' + group.id">{{ 'ux.performance.groups.' + group.id | t }}</h3>
            </div>
            <dl appCardContent class="grid grid-cols-2 gap-x-6 gap-y-5">
              @for (metric of group.metrics; track metric.label) {
                <div>
                  <dt class="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{{ metric.label }}</dt>
                  <dd class="tabular mt-1 text-2xl font-semibold tracking-tight" dir="ltr">{{ metric.value }}</dd>
                  @if (metric.hint) {
                    <dd class="mt-0.5 text-xs text-muted-foreground">{{ metric.hint }}</dd>
                  }
                </div>
              }
            </dl>
          </section>
        }
      </div>

      @if (p.calls.byOutcome.length) {
        <section appCard aria-labelledby="perf-outcomes">
          <div appCardHeader>
            <h3 appCardTitle id="perf-outcomes">{{ 'ux.performance.callOutcomes' | t }}</h3>
          </div>
          <ul appCardContent class="flex flex-col gap-3">
            @for (row of p.calls.byOutcome; track row.outcomeCode) {
              <li class="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                <span class="truncate">{{ reference.label('call_outcome', row.outcomeCode) }}</span>
                <span class="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span class="block h-full rounded-full bg-primary/70 transition-[width] duration-500 ease-premium" [style.width.%]="(row.count / p.calls.total) * 100"></span>
                </span>
                <span class="tabular text-muted-foreground">{{ i18n.formatNumber(row.count) }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section appCard aria-labelledby="perf-activity">
        <div appCardHeader>
          <h3 appCardTitle id="perf-activity">{{ 'ux.performance.recent' | t }}</h3>
          <p appCardDescription>{{ 'ux.performance.recentHint' | t }}</p>
        </div>
        <div appCardContent>
          @if (p.recentActivity.length) {
            <ol class="flex flex-col">
              @for (event of p.recentActivity; track event.id; let last = $last) {
                <li class="relative flex gap-4 pb-5" [class.pb-0]="last">
                  @if (!last) {
                    <span class="absolute start-[0.3125rem] top-3 h-full w-px bg-border" aria-hidden="true"></span>
                  }
                  <span class="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" aria-hidden="true"></span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm">{{ describe(event) }}</p>
                    <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <time [attr.datetime]="event.occurredAt">{{ i18n.formatRelative(event.occurredAt) }}</time>
                      @if (recordLink(event); as link) {
                        <span aria-hidden="true">·</span>
                        <a class="text-primary underline-offset-4 hover:underline" [routerLink]="link.commands">{{ link.label | t }}</a>
                      }
                    </p>
                  </div>
                </li>
              }
            </ol>
          } @else {
            <p class="text-sm text-muted-foreground">{{ 'ux.performance.noActivity' | t }}</p>
          }
        </div>
      </section>
    } @else if (data.isLoading()) {
      <app-detail-skeleton [label]="'common.labels.loading' | t" [summary]="6" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class UserDetailPage {
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
  protected readonly crumbs = computed(() => {
    const user = this.data.value()?.user;
    return [{ label: this.i18n.t('navigation.items.users'), path: '/admin/users' }, { label: user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '' }];
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
