import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { AnalyticsApi } from '../analytics-api.service';
import { DashboardSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

/**
 * The System Administrator's workspace (§11): platform health only —
 * accounts, sessions, automation, sign-in security and integrations. It shows
 * no business records, and links only to the admin screens the role opens.
 */
@Component({
  selector: 'app-platform-dashboard',
  imports: [DashboardSkeletonComponent, TranslatePipe, AlertComponent, StatCardComponent],
  template: `
    @if (data.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(data.error()) }}</app-alert>
    }
    @if (data.value(); as d) {
      <section class="flex flex-col gap-3" aria-labelledby="platform-heading">
        <div>
          <h2 id="platform-heading" class="text-lg font-semibold">{{ 'analytics.platform.title' | t }}</h2>
          <p class="text-sm text-muted-foreground">{{ 'analytics.platform.subtitle' | t }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <app-stat-card [label]="'analytics.platform.activeUsers' | t" [value]="n(d.users.active)" [link]="adminLink('/admin/users', 'administration.manage_users')" />
          <app-stat-card [label]="'analytics.platform.lockedUsers' | t" [value]="n(d.users.locked)" [tone]="d.users.locked ? 'warning' : 'neutral'" [link]="adminLink('/admin/users', 'administration.manage_users')" />
          <app-stat-card [label]="'analytics.platform.pendingPasswordChange' | t" [value]="n(d.users.pendingPasswordChange)" />
          <app-stat-card [label]="'analytics.platform.inactiveUsers' | t" [value]="n(d.users.inactive)" />
          <app-stat-card [label]="'analytics.platform.activeSessions' | t" [value]="n(d.activeSessions)" />
          <app-stat-card [label]="'analytics.platform.failedAutomations' | t" [value]="n(d.automation.failed)" [tone]="d.automation.failed ? 'danger' : 'neutral'" [link]="adminLink('/admin/automation', 'automation.manage')" />
          <app-stat-card [label]="'analytics.platform.succeededAutomations' | t" [value]="n(d.automation.succeededLast24h)" />
          <app-stat-card [label]="'analytics.platform.failedLogins' | t" [value]="n(d.security.failedLoginsLast24h)" [tone]="d.security.failedLoginsLast24h ? 'warning' : 'neutral'" [link]="adminLink('/admin/audit', 'audit.view_security')" />
          <app-stat-card [label]="'analytics.platform.securityEvents' | t" [value]="n(d.security.eventsLast24h)" [link]="adminLink('/admin/audit', 'audit.view_security')" />
          <app-stat-card [label]="'analytics.platform.integrationKeys' | t" [value]="n(d.integrations.activeKeys)" [link]="adminLink('/admin/integrations', 'integrations.manage')" />
        </div>
      </section>
    } @else if (data.isLoading()) {
      <app-dashboard-skeleton [label]="'common.labels.loading' | t" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class PlatformDashboardComponent {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly data = rxResource({ stream: () => this.api.platform() });

  protected n(value: number): string {
    return this.i18n.formatNumber(value);
  }

  /** A card links only to a screen the user may open. */
  protected adminLink(path: string, permission: Parameters<AuthService['can']>[0]): string | undefined {
    return this.auth.can(permission) ? `/${this.i18n.locale()}${path}` : undefined;
  }
}
