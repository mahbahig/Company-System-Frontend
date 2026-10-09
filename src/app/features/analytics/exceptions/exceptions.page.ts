import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { NAV_SECTIONS } from '../../../core/navigation/nav-sections';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { AnalyticsApi } from '../analytics-api.service';
import type { ExceptionSummary } from '../models/exceptions.interface';
import { percent } from '../shared/kpi-format';

/** Where a drill-down row of each exception opens. */
const RECORD_ROUTE: Record<string, string> = {
  leads_outside_sla: 'leads',
  unassigned_leads: 'leads',
  stagnant_opportunities: 'opportunities',
  opportunities_without_next_action: 'opportunities',
  missing_technical_documents: 'opportunities',
  overdue_followups: 'tasks',
  enrichment_overdue: 'customers',
  handoffs_awaiting_acceptance: 'handoffs',
  pending_approvals: 'approvals',
  expiring_proposals: 'proposals/combined',
  contracts_awaiting_signature: 'contracts',
  delayed_projects: 'projects',
  ownership_conflicts: 'ownership-requests',
  duplicate_suggestions: 'duplicates',
  failed_automations: 'admin/automation',
};

/** Columns that hold dates (shown formatted) in the drill-down rows. */
const DATE_FIELDS = new Set(['sla.dueAt', 'createdAt', 'stageEnteredAt', 'dueAt', 'enrichmentDueAt', 'submittedAt', 'slaDueAt', 'validUntil', 'sentForSignatureAt', 'targetEndDate', 'nextActionAt', 'updatedAt']);

/**
 * EXC-01/02 Exception / Attention Center and DQ-01 data quality. Counts come
 * pre-scoped by the API (a rep sees their own, a manager their team), and
 * every count drills down into the offending records.
 */
@Component({
  selector: 'app-exceptions-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, TabsComponent, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'exceptionsCenter.title' | t" [subtitle]="'exceptionsCenter.subtitle' | t" class="!mb-0" />

    @if (tabs().length > 1) {
      <app-tabs [tabs]="tabs()" [active]="activeTab()" (activeChange)="selectTab($event)" [label]="'exceptionsCenter.title' | t" />
    }

    @if (activeTab() === 'exceptions') {
      @if (summary.error()) {
        <app-alert variant="destructive">{{ i18n.errorText(summary.error()) }}</app-alert>
      }
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (item of items(); track item.code) {
          <button
            type="button"
            class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-start shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [class.ring-2]="code() === item.code"
            [class.ring-primary]="code() === item.code"
            [attr.aria-pressed]="code() === item.code"
            (click)="open(item)"
          >
            <span class="flex flex-col gap-1">
              <span class="text-sm font-medium">{{ 'exceptionsCenter.codes.' + item.code | t }}</span>
              <app-status-badge enum="exceptionSeverity" [value]="item.severity" [tone]="item.count ? undefined : 'neutral'" />
            </span>
            <span class="tabular text-2xl font-semibold" [class.text-destructive]="item.count > 0 && (item.severity === 'critical' || item.severity === 'high')">{{ i18n.formatNumber(item.count) }}</span>
          </button>
        }
      </div>

      @if (code()) {
        <section class="flex flex-col gap-3" aria-labelledby="drill-heading">
          <h2 id="drill-heading" class="text-lg font-semibold">{{ 'exceptionsCenter.codes.' + code() | t }}</h2>
          @if (detail.value(); as d) {
            <app-table-wrapper [label]="'exceptionsCenter.codes.' + code() | t">
              <table appTable>
                <thead appTableHeader>
                  <tr appTableRow>
                    @for (column of columns(); track column) {
                      <th appTableHead>{{ 'exceptionsCenter.fields.' + column.replace('.', '_') | t }}</th>
                    }
                    <th appTableHead><span class="sr-only">{{ 'crm.common.actions' | t }}</span></th>
                  </tr>
                </thead>
                <tbody appTableBody>
                  @for (row of d.rows; track $index) {
                    <tr appTableRow>
                      @for (column of columns(); track column) {
                        <td appTableCell class="whitespace-nowrap">{{ cell(row, column) }}</td>
                      }
                      <td appTableCell>
                        @if (recordLink(row); as path) {
                          <a [routerLink]="path" class="text-sm text-primary hover:underline">{{ 'crm.common.view' | t }}</a>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr app-table-empty [colSpan]="columns().length + 1">{{ 'exceptionsCenter.clean' | t }}</tr>
                  }
                </tbody>
              </table>
            </app-table-wrapper>
          } @else if (detail.isLoading()) {
            <p class="text-sm text-muted-foreground">{{ 'common.labels.loading' | t }}</p>
          }
        </section>
      }
    } @else {
      @if (quality.error()) {
        <app-alert variant="destructive">{{ i18n.errorText(quality.error()) }}</app-alert>
      }
      @if (quality.value(); as q) {
        <app-table-wrapper [label]="'exceptionsCenter.dataQuality' | t">
          <table appTable>
            <thead appTableHeader>
              <tr appTableRow>
                <th appTableHead>{{ 'exceptionsCenter.check' | t }}</th>
                <th appTableHead>{{ 'exceptionsCenter.records' | t }}</th>
                <th appTableHead>{{ 'exceptionsCenter.share' | t }}</th>
                <th appTableHead><span class="sr-only">{{ 'crm.common.actions' | t }}</span></th>
              </tr>
            </thead>
            <tbody appTableBody>
              @for (item of q.items; track item.code) {
                <tr appTableRow>
                  <td appTableCell class="font-medium">{{ 'exceptionsCenter.quality.' + item.code | t }}</td>
                  <td appTableCell class="tabular" [class.text-destructive]="item.count > 0">{{ i18n.formatNumber(item.count) }}</td>
                  <td appTableCell class="tabular">{{ item.of === undefined ? '—' : pct(item.rate ?? null) + ' / ' + i18n.formatNumber(item.of) }}</td>
                  <td appTableCell>
                    @if (canOpen(item.route)) {
                      <a [routerLink]="link(item.route)" [queryParams]="query(item.route)" class="text-sm text-primary hover:underline">{{ 'crm.common.view' | t }}</a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </app-table-wrapper>
        <section appCard aria-labelledby="completeness-heading">
          <div appCardHeader><h2 appCardTitle id="completeness-heading">{{ 'exceptionsCenter.customerCompleteness' | t }}</h2></div>
          <div appCardContent class="grid gap-3 sm:grid-cols-4">
            @for (band of q.customerCompleteness; track band.band) {
              <div class="rounded-md border border-border p-3 text-center">
                <p class="tabular text-xl font-semibold">{{ i18n.formatNumber(band.count) }}</p>
                <p class="text-xs text-muted-foreground" dir="ltr">{{ bandLabel(band.band) }}</p>
              </div>
            }
          </div>
        </section>
      }
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ExceptionsPage {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  readonly tab = input<string>();
  readonly code = input<string>();

  protected readonly tabs = computed<TabItem[]>(() => {
    const list: TabItem[] = [];
    if (this.auth.can('exceptions.view')) list.push({ id: 'exceptions', label: this.i18n.t('exceptionsCenter.title') });
    if (this.auth.can('data.view_quality')) list.push({ id: 'data-quality', label: this.i18n.t('exceptionsCenter.dataQuality') });
    return list;
  });
  protected readonly activeTab = computed(() => (this.tabs().some((tab) => tab.id === this.tab()) ? (this.tab() as string) : (this.tabs()[0]?.id ?? 'exceptions')));

  protected readonly summary = rxResource({
    params: () => (this.activeTab() === 'exceptions' && this.auth.can('exceptions.view') ? true : undefined),
    stream: ({ params }) => (params ? this.api.exceptions() : of(undefined)),
  });
  protected readonly items = computed<ExceptionSummary[]>(() => this.summary.value()?.items ?? []);

  protected readonly detail = rxResource({ params: () => this.code(), stream: ({ params }) => (params ? this.api.exception(params) : of(undefined)) });
  protected readonly columns = computed(() => {
    const rows = this.detail.value()?.rows ?? [];
    const keys = new Set<string>();
    for (const row of rows.slice(0, 5)) for (const key of flatKeys(row)) if (key !== 'id' && key !== '_id') keys.add(key);
    return [...keys].slice(0, 6);
  });

  protected readonly quality = rxResource({
    params: () => (this.activeTab() === 'data-quality' ? true : undefined),
    stream: ({ params }) => (params ? this.api.dataQuality() : of(undefined)),
  });

  protected selectTab(tab: string): void {
    void this.router.navigate([], { queryParams: { tab: tab === 'exceptions' ? null : tab, code: null }, queryParamsHandling: 'merge' });
  }

  protected open(item: ExceptionSummary): void {
    void this.router.navigate([], { queryParams: { code: item.code }, queryParamsHandling: 'merge' });
  }

  protected cell(row: Record<string, unknown>, column: string): string {
    const value = column.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), row);
    if (value === null || value === undefined || value === '') return '—';
    if (DATE_FIELDS.has(column)) return this.i18n.formatDate(String(value), true);
    if (typeof value === 'number') return this.i18n.formatNumber(value);
    if (typeof value === 'object') return '—';
    const enumName = ENUM_COLUMNS[column];
    return enumName ? this.i18n.t(`enums.${enumName}.${value}`) : String(value);
  }

  protected recordLink(row: Record<string, unknown>): string[] | null {
    const base = RECORD_ROUTE[this.code() ?? ''];
    const id = (row['id'] ?? row['_id']) as string | undefined;
    if (!base || !id) return null;
    if (['ownership-requests', 'duplicates', 'admin/automation'].includes(base)) return ['/', this.i18n.locale(), ...base.split('/')];
    if (base === 'handoffs') {
      const opportunityId = row['opportunityId'];
      const opp = opportunityId && typeof opportunityId === 'object' ? (opportunityId as { id?: string; _id?: string }).id ?? (opportunityId as { _id?: string })._id : opportunityId;
      return opp ? ['/', this.i18n.locale(), 'opportunities', String(opp), 'handoff'] : null;
    }
    return ['/', this.i18n.locale(), ...base.split('/'), String(id)];
  }

  /** Only offer a drill-down the user's role can actually open (same rule as the menu). */
  protected canOpen(route: string): boolean {
    const path = route.split('?')[0];
    const item = NAV_SECTIONS.flatMap((section) => section.items).find((entry) => entry.path === path || path.startsWith(entry.path + '/'));
    if (!item || item.permission === null) return true;
    return typeof item.permission === 'string' ? this.auth.can(item.permission) : this.auth.canAny(item.permission);
  }

  protected link(route: string): string {
    return `/${this.i18n.locale()}${route.split('?')[0]}`;
  }

  protected query(route: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(route.split('?')[1] ?? ''));
  }

  protected pct(value: number | null): string {
    return percent(this.i18n, value);
  }

  protected bandLabel(band: number | string): string {
    const labels: Record<string, string> = { '0': '0–49%', '50': '50–79%', '80': '80–99%', '100': '100%' };
    return labels[String(band)] ?? String(band);
  }
}

const ENUM_COLUMNS: Record<string, string> = { priority: 'priority', kind: 'taskKind', status: 'handoffStatus', 'health.status': 'healthStatus', type: 'approvalType', intakeStatus: 'intakeStatus', handoffStatus: 'handoffStatus' };

function flatKeys(row: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(row).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && Object.keys(value).length < 6 && !/^[a-f\d]{24}$/i.test(String(value))
      ? flatKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}
