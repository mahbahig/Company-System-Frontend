import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TabsComponent } from '../../shared/ui/tabs/tabs.component';
import type { TabItem } from '../../shared/ui/tabs/tab-item.interface';
import { AnalyticsApi } from '../analytics/analytics-api.service';
import { ExecutiveDashboardComponent } from '../analytics/dashboards/executive-dashboard.component';
import { FinanceDashboardComponent } from '../analytics/dashboards/finance-dashboard.component';
import { MarketingDashboardComponent } from '../analytics/dashboards/marketing-dashboard.component';
import { OperationalDashboardComponent } from '../analytics/dashboards/operational-dashboard.component';
import { PersonalDashboardComponent } from '../analytics/dashboards/personal-dashboard.component';
import { SalesDashboardComponent } from '../analytics/dashboards/sales-dashboard.component';
import type { AnalyticsFilter } from '../analytics/models/analytics-filter.interface';
import type { DashboardCode } from '../analytics/models/dashboards.interface';
import { AnalyticsFilterBarComponent } from '../analytics/shared/analytics-filter-bar.component';

/**
 * §11 role workspace: the personal dashboard plus every dashboard the user's
 * roles open (executive, sales, marketing, operational, finance), selected by
 * `?view=` so a tab can be bookmarked. Filters live in the URL too.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    TranslatePipe,
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
    ...CARD_IMPORTS,
  ],
  template: `
    <app-page-header [heading]="'dashboard.welcome' | t: { name: name() }" [subtitle]="subtitle()" class="!mb-0">
      @for (role of user()?.roles ?? []; track role.id) {
        <app-badge tone="info">{{ i18n.pick(role.nameAr, role.nameEn) }}</app-badge>
      }
    </app-page-header>

    @if (tabs().length > 1) {
      <app-tabs [tabs]="tabs()" [active]="active()" (activeChange)="select($event)" [label]="'analytics.dashboards' | t" />
    }

    @if (active() !== 'personal') {
      <app-analytics-filter-bar [filter]="filter()" />
    }

    @switch (active()) {
      @case ('executive') { <app-executive-dashboard [filter]="filter()" /> }
      @case ('sales') { <app-sales-dashboard [filter]="filter()" /> }
      @case ('marketing') { <app-marketing-dashboard [filter]="filter()" /> }
      @case ('operational') { <app-operational-dashboard [filter]="filter()" /> }
      @case ('finance') { <app-finance-dashboard [filter]="filter()" /> }
      @default { <app-personal-dashboard [filter]="filter()" /> }
    }
  `,
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
    const codes: DashboardCode[] = this.available.hasValue() ? this.available.value().dashboards : ['personal'];
    return codes.map((code) => ({ id: code, label: this.i18n.t(`analytics.tabs.${code}`) }));
  });

  protected readonly active = computed(() => {
    const view = this.view();
    return this.tabs().some((tab) => tab.id === view) ? (view as string) : 'personal';
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
    return last ? this.i18n.t('analytics.lastLogin', { date: last }) : this.i18n.t('dashboard.signedInAs', { email: user?.email ?? '' });
  });

  protected select(view: string): void {
    void this.router.navigate([], { queryParams: { view: view === 'personal' ? null : view }, queryParamsHandling: 'merge' });
  }
}
