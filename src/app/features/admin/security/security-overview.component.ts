import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import type { SecurityOverview } from './security-api.service';

/**
 * The Security Center's numbers, in two groups — authentication (sign-ins,
 * sessions, locked and deactivated accounts) and security (alerts, critical
 * and high audit events, suspicious accounts, two-factor adoption) — plus the
 * employees with repeated failed sign-ins. Every number comes from the API's
 * persisted data; the drill-downs open the matching audit view.
 */
@Component({
  selector: 'app-security-overview',
  imports: [TranslatePipe, RouterLink, StatCardComponent],
  templateUrl: './security-overview.component.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SecurityOverviewComponent {
  protected readonly i18n = inject(I18nService);
  readonly overview = input.required<SecurityOverview>();

  protected readonly n = (value: number) => this.i18n.formatNumber(value);
  protected readonly auditLink = computed(() => ['/', 'admin', 'audit']);
  protected readonly mfaPercent = computed(() => {
    const { enabled, activeAccounts } = this.overview().security.mfa;
    return activeAccounts ? Math.round((enabled / activeAccounts) * 100) : 0;
  });
  protected readonly alertTone = computed(() => {
    const security = this.overview().security;
    return security.criticalAlerts ? 'danger' : security.openAlerts ? 'warning' : 'success';
  });
}
