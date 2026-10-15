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
 * `exception=<code>` (`quality=<code>` from a Data quality row) so that page
 * can say where the user came from. Cards for
 * a page the role cannot open are shown, but not as links.
 */
@Component({
  selector: 'app-exceptions-page',
  imports: [NgTemplateOutlet, ListSkeletonComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, TabsComponent, TooltipDirective, ...CARD_IMPORTS, ...TABLE_IMPORTS],
  templateUrl: './exceptions.page.html',
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

  /** A Data quality row's filter plus its code, so the list can say where the user came from. */
  protected qualityQuery(code: string, route: string): Record<string, string> {
    return { ...this.query(route), quality: code };
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
