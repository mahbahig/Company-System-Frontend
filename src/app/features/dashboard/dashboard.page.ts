import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { HeroBannerComponent } from '../../shared/ui/hero-banner/hero-banner.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TabsComponent } from '../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../shared/ui/tabs/tab-item.interface';
import { AnalyticsApi } from '../analytics/analytics-api.service';
import { ExecutiveDashboardComponent } from '../analytics/dashboards/executive-dashboard.component';
import { FinanceDashboardComponent } from '../analytics/dashboards/finance-dashboard.component';
import { MarketingDashboardComponent } from '../analytics/dashboards/marketing-dashboard.component';
import { OperationalDashboardComponent } from '../analytics/dashboards/operational-dashboard.component';
import { PersonalDashboardComponent } from '../analytics/dashboards/personal-dashboard.component';
import { PlatformDashboardComponent } from '../analytics/dashboards/platform-dashboard.component';
import { SalesDashboardComponent } from '../analytics/dashboards/sales-dashboard.component';
import type { AnalyticsFilter } from '../analytics/models/analytics-filter.interface';
import type { DashboardCode } from '../analytics/models/dashboards.interface';
import { AnalyticsFilterBarComponent } from '../analytics/shared/analytics-filter-bar.component';
import { QuickAccessComponent } from './quick-access.component';

/**
 * §11 role workspace: exactly the dashboards the user's roles open, as decided
 * by the server (`GET /dashboards`) — personal, executive, sales, marketing,
 * operational, finance, or the administrator's platform dashboard — selected
 * by `?view=` so a tab can be bookmarked. Filters live in the URL too. Every
 * signed-in user lands here; a role without dashboards gets a plain notice.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    QuickAccessComponent,
    TranslatePipe,
    HeroBannerComponent,
    PageHeaderComponent,
    BadgeComponent,
    TabsComponent,
    AnalyticsFilterBarComponent,
    PersonalDashboardComponent,
    ExecutiveDashboardComponent,
    SalesDashboardComponent,
    MarketingDashboardComponent,
    OperationalDashboardComponent,
    FinanceDashboardComponent,
    PlatformDashboardComponent,
    ...CARD_IMPORTS,
  ],
  templateUrl: './dashboard.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsApi);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  // Query params (router input binding).
  readonly view = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly ownerId = input<string>();
  readonly sourceCode = input<string>();
  readonly campaignCode = input<string>();
  readonly governorateCode = input<string>();
  readonly solutionTypeCode = input<string>();

  protected readonly user = this.auth.user;
  protected readonly available = rxResource({ stream: () => this.analytics.available() });

  protected readonly tabs = computed<TabItem[]>(() => {
    // Fail closed: only the dashboards the server says the role opens (none while loading).
    const codes: DashboardCode[] = this.available.hasValue()
      ? this.available.value().dashboards
      : [];
    return codes.map((code) => ({ id: code, label: this.i18n.t(`analytics.tabs.${code}`) }));
  });

  protected readonly active = computed(() => {
    const view = this.view();
    const tabs = this.tabs();
    return tabs.some((tab) => tab.id === view) ? (view as string) : (tabs[0]?.id ?? null);
  });

  protected readonly filter = computed<AnalyticsFilter>(() => ({
    from: this.from(),
    to: this.to(),
    ownerId: this.ownerId(),
    sourceCode: this.sourceCode(),
    campaignCode: this.campaignCode(),
    governorateCode: this.governorateCode(),
    solutionTypeCode: this.solutionTypeCode(),
  }));

  protected readonly name = computed(() => {
    const user = this.user();
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '';
  });

  protected readonly subtitle = computed(() => {
    const user = this.user();
    const last = this.i18n.formatDate(user?.lastLoginAt, true);
    return last
      ? this.i18n.t('analytics.lastLogin', { date: last })
      : this.i18n.t('dashboard.signedInAs', { email: user?.email ?? '' });
  });

  protected select(view: string): void {
    void this.router.navigate([], {
      queryParams: { view: view === this.tabs()[0]?.id ? null : view },
      queryParamsHandling: 'merge',
    });
  }
}
