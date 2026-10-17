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
  templateUrl: './platform-dashboard.component.html',
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
    return this.auth.can(permission) ? path : undefined;
  }
}
