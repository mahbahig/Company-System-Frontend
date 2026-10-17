import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RefreshCw } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SystemStatusCardComponent } from '../system-status/system-status-card.component';
import { SecurityActivityComponent } from './security-activity.component';
import { SecurityAlertsComponent } from './security-alerts.component';
import { SecurityApi } from './security-api.service';
import { SecurityOverviewComponent } from './security-overview.component';
import { SystemHealthComponent } from './system-health.component';

/** How often the health section refreshes while the page is visible (the API reuses a check for 10 s). */
const HEALTH_POLL_MS = 30_000;

/**
 * Security Center (Super Administrators only — the route needs the security
 * permission and the API refuses everyone else on every endpoint): the
 * system's state and switches, the security overview, recent security
 * activity, the security alerts and the system's health — in that order, so
 * the page reads from "is everything all right?" down to the details.
 */
@Component({
  selector: 'app-security-center-page',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent, PageHeaderComponent, SystemStatusCardComponent, SecurityOverviewComponent, SecurityActivityComponent, SecurityAlertsComponent, SystemHealthComponent],
  templateUrl: './security-center.page.html',
  host: { class: 'flex flex-col gap-8' },
})
export class SecurityCenterPage {
  private readonly api = inject(SecurityApi);
  private readonly document = inject(DOCUMENT);
  protected readonly i18n = inject(I18nService);
  protected readonly refreshIcon = RefreshCw;

  protected readonly overview = rxResource({ stream: () => this.api.overview() });
  private readonly freshHealth = signal(0);
  protected readonly health = rxResource({ params: () => this.freshHealth(), stream: ({ params }) => this.api.health(params > 0) });
  private readonly activity = viewChild(SecurityActivityComponent);

  constructor() {
    const timer = setInterval(() => {
      if (this.document.visibilityState === 'visible') this.health.reload();
    }, HEALTH_POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** Everything again: the counts, the activity, and a fresh health check. */
  protected refreshAll(): void {
    this.overview.reload();
    this.activity()?.reload();
    this.refreshHealth();
  }

  protected refreshHealth(): void {
    this.freshHealth.update((value) => value + 1);
  }

  /** An alert was acknowledged or resolved: the counts change. */
  protected onAlertChanged(): void {
    this.overview.reload();
    this.activity()?.reload();
  }
}
