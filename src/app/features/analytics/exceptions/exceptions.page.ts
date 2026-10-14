import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../../shared/ui/tabs/tab-item.interface';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { AnalyticsApi } from '../analytics-api.service';
import type { ExceptionSummary } from '../models/exceptions.interface';
import { percent } from '../shared/kpi-format';
import { ListSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/**
 * EXC-01/02 Exception / Attention Center and DQ-01 data quality. Counts come
 * pre-scoped by the API (a rep sees their own, a manager their team). A card
 * does not show the records here: it opens the existing page for them (leads,
 * opportunities, tasks, projects …) with the matching filter applied, plus
 * `exception=<code>` so that page can say where the user came from. Cards for
 * a page the role cannot open are shown, but not as links.
 */
@Component({
  selector: 'app-exceptions-page',
  imports: [NgTemplateOutlet, ListSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, TabsComponent, TooltipDirective, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'exceptionsCenter.title' | t" [subtitle]="'exceptionsCenter.subtitle' | t" class="!mb-0" />

    @if (tabs().length > 1) {
      <app-tabs [tabs]="tabs()" [active]="activeTab()" (activeChange)="selectTab($event)" [label]="'exceptionsCenter.title' | t" />
    }

    @if (activeTab() === 'exceptions') {
      @if (summary.error()) {
        <app-alert variant="destructive">{{ i18n.errorText(summary.error()) }}</app-alert>
      }
      @if (summary.isLoading()) {
        <div role="status" [attr.aria-label]="'common.labels.loading' | t"><app-list-skeleton [rows]="4" /></div>
      }
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        @for (item of items(); track item.code) {
          <li>
            @if (canOpen(item.route)) {
              <a
                [routerLink]="link(item.route)"
                [queryParams]="destinationQuery(item)"
                class="flex h-full items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 text-start text-card-foreground shadow-sm outline-none transition-[transform,box-shadow] duration-200 ease-premium will-change-transform hover:scale-[1.03] hover:shadow-lg focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[1.01] motion-reduce:hover:scale-100"
                [attr.aria-label]="('exceptionsCenter.codes.' + item.code | t) + ': ' + i18n.formatNumber(item.count)"
              >
                <ng-container *ngTemplateOutlet="cardBody; context: { $implicit: item }" />
              </a>
            } @else {
              <div
                class="flex h-full items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 text-card-foreground opacity-80"
                [appTooltip]="'ux.exceptions.noAccess' | t"
                tabindex="0"
              >
                <ng-container *ngTemplateOutlet="cardBody; context: { $implicit: item }" />
              </div>
            }
          </li>
        }
      </ul>
      <ng-template #cardBody let-item>
        <span class="flex min-w-0 flex-col items-start gap-2">
          <span class="text-sm font-medium leading-snug">{{ 'exceptionsCenter.codes.' + item.code | t }}</span>
          <app-status-badge enum="exceptionSeverity" [value]="item.severity" [tone]="item.count ? undefined : 'neutral'" />
        </span>
        <span class="tabular shrink-0 text-3xl font-semibold tracking-tight" [class.text-destructive]="item.count > 0 && (item.severity === 'critical' || item.severity === 'high')" [class.text-muted-foreground]="item.count === 0">
          {{ i18n.formatNumber(item.count) }}
        </span>
      </ng-template>
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
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);

  readonly tab = input<string>();

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

  protected readonly quality = rxResource({
    params: () => (this.activeTab() === 'data-quality' ? true : undefined),
    stream: ({ params }) => (params ? this.api.dataQuality() : of(undefined)),
  });

  protected selectTab(tab: string): void {
    void this.router.navigate([], { queryParams: { tab: tab === 'exceptions' ? null : tab }, queryParamsHandling: 'merge' });
  }

  /** The destination's own filter (from the API's route) plus where the user came from. */
  protected destinationQuery(item: ExceptionSummary): Record<string, string> {
    return { ...this.query(item.route), exception: item.code };
  }

  /** Only offer a drill-down the user's role can actually open (same rule as the route guard). */
  protected canOpen(route: string): boolean {
    return this.navigation.canOpen(route);
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
