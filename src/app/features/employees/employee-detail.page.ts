import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CalendarClock, ClipboardCheck, History, KeyRound, LogOut, MapPin, Pencil, PhoneCall, ShieldCheck, Target, UserCheck, UserRound, UserX, type IconNode } from 'lucide';
import { of } from 'rxjs';


import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { isSuperAdministrator } from '../../core/auth/super-administrator';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NavigationService } from '../../core/navigation/navigation.service';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import { BreadcrumbsComponent } from '../../shared/crm/breadcrumbs/breadcrumbs.component';
import { TimelineTextService } from '../../shared/crm/timeline/timeline-text.service';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { ActionRunner } from '../../shared/utils/action-runner';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { DetailSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatusPageComponent } from '../errors/status-page.component';
import { AdminApi, type EmployeePerformance, type Role, type Team } from '../admin/admin-api.service';
import { EmployeeAccountActions } from './employee-account-actions.service';
import { EmployeeDeactivateComponent } from './employee-deactivate.component';
import { EmployeeEditorComponent } from './employee-editor.component';
import { EmployeeSessionsComponent } from './employee-sessions.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';

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
 *
 * For the Super Administrator the page also manages the account — Edit,
 * Deactivate / Activate, Reset Password, Log Out All Sessions
 * (`administration.manage_users`) — and shows its Security Activity summary
 * (last sign-in, sign-ins, failed attempts, lockouts, password changes,
 * sessions, two-factor) with "View Audit Logs" — the audit log filtered to the
 * employee, the one place for the audit records themselves (no audit table is
 * embedded here) — and its active sessions (`security.view_sessions`). Another Super Administrator's account
 * is read only: none of that is offered (the API refuses it all too).
 */
@Component({
  selector: 'app-employee-detail-page',
  imports: [AvatarComponent, 
    RouterLink,
    TranslatePipe,
    BreadcrumbsComponent,
    AlertComponent,
    BadgeComponent,
    IconComponent,
    DetailSkeletonComponent,
    StatusPageComponent,
    EmployeeSessionsComponent,
    EmployeeEditorComponent,
    EmployeeDeactivateComponent,
    ButtonDirective,
    ...CARD_IMPORTS,
  ],
  templateUrl: './employee-detail.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class EmployeeDetailPage {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly timelineText = inject(TimelineTextService);
  protected readonly auth = inject(AuthService);
  private readonly accountActions = inject(EmployeeAccountActions);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly icons = { edit: Pencil, deactivate: UserX, activate: UserCheck, reset: KeyRound, logOut: LogOut, security: ShieldCheck, audit: History, manage: UserRound };

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
  /** The employee's sessions: for the Super Administrator, about a normal employee other than themself. */
  protected readonly showSessions = computed(() => {
    const user = this.data.value()?.user;
    return !!user && this.auth.can('security.view_sessions') && !isSuperAdministrator(user) && user.id !== this.auth.user()?.id;
  });

  protected readonly target = computed(() => this.data.value()?.user ?? null);
  protected readonly isSelf = computed(() => !!this.target() && this.target()!.id === this.auth.user()?.id);
  /** Another Super Administrator: read only — nothing of their account is managed or inspected from here. */
  protected readonly isPeerAdmin = computed(() => !!this.target() && !this.isSelf() && isSuperAdministrator(this.target()!));
  protected readonly canManage = computed(() => this.auth.can('administration.manage_users') && !!this.target() && !this.isPeerAdmin());
  /** The full account record, for the editor and the account state (loaded only for those who manage it). */
  protected readonly account = rxResource({ params: () => (this.canManage() ? this.id() : undefined), stream: ({ params }) => this.api.user(params) });
  protected readonly roles = rxResource({ params: () => (this.canManage() ? true : undefined), stream: ({ params }) => (params ? this.api.roles() : of([] as Role[])) });
  protected readonly teams = rxResource({ params: () => (this.canManage() ? true : undefined), stream: ({ params }) => (params ? this.api.teams() : of([] as Team[])) });
  protected readonly showSecurity = computed(() => this.auth.can('security.view_sessions') && !!this.target() && !this.isPeerAdmin());
  protected readonly security = rxResource({ params: () => (this.showSecurity() ? this.id() : undefined), stream: ({ params }) => this.api.securityActivity(params) });
  /** "View Audit Logs" leads to the audit log filtered to this employee — offered only where the audit log can be opened. */
  protected readonly canOpenAudit = computed(() => this.navigation.canOpen('/admin/audit'));
  protected readonly editorOpen = signal(false);
  protected readonly deactivateOpen = signal(false);
  protected readonly secret = signal<string | null>(null);
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

  protected onSaved(messageKey: string): void {
    this.actions.message.set(this.i18n.t(messageKey));
    this.refresh();
  }

  protected onDeactivated(): void {
    this.actions.message.set(this.i18n.t('admin.users.deactivated'));
    this.refresh();
  }

  protected async reset(): Promise<void> {
    const user = this.target();
    if (!user) return;
    const temporaryPassword = await this.accountActions.resetPassword(user);
    if (temporaryPassword === null) return;
    this.secret.set(temporaryPassword);
    this.actions.message.set(this.i18n.t('admin.users.passwordReset'));
    this.refresh();
  }

  protected async logOutEverywhere(): Promise<void> {
    const user = this.target();
    if (!user || !(await this.accountActions.logOutEverywhere(user))) return;
    this.actions.message.set(this.i18n.t('admin.users.loggedOut'));
    this.refresh();
  }

  protected async activate(): Promise<void> {
    const user = this.target();
    if (!user || !(await this.accountActions.activate(user))) return;
    this.actions.message.set(this.i18n.t('admin.users.activated'));
    this.refresh();
  }

  private refresh(): void {
    this.data.reload();
    this.account.reload();
    this.security.reload();
  }

  protected selectPeriod(period: Period): void {
    void this.router.navigate([], { queryParams: { period: period === '30d' ? null : period }, queryParamsHandling: 'merge', replaceUrl: true });
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
      if (id && this.navigation.canOpen(`/${area}/${id}`)) return { commands: ['/', area, id], label };
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
