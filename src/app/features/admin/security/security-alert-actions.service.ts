import { Service, inject } from '@angular/core';
import { tap } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { SecurityApi, type SecurityAlert } from './security-api.service';

/**
 * Acknowledge / resolve a security alert — the same from the alerts table and
 * the alert's page: a contextual confirmation (which alert, what it means),
 * the request running inside it, resolved with the updated alert only after
 * the API succeeded (null when cancelled). The API refuses both to anyone but
 * a Super Administrator, and refuses moves the lifecycle does not allow.
 */
@Service()
export class SecurityAlertActions {
  private readonly api = inject(SecurityApi);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  async acknowledge(alert: SecurityAlert): Promise<SecurityAlert | null> {
    let updated: SecurityAlert | null = null;
    const done = await this.confirm.confirm({
      heading: this.i18n.t('securityCenter.alerts.confirm.acknowledgeTitle', { title: this.title(alert) }),
      message: this.i18n.t('securityCenter.alerts.confirm.acknowledgeBody'),
      details: [this.i18n.t('securityCenter.alerts.confirm.acknowledgeReviewed')],
      confirmLabel: this.i18n.t('securityCenter.alerts.acknowledge'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'default',
      action: () => this.api.acknowledge(alert.id).pipe(tap((result) => (updated = result))),
    });
    return done ? updated : null;
  }

  async resolve(alert: SecurityAlert): Promise<SecurityAlert | null> {
    let updated: SecurityAlert | null = null;
    const done = await this.confirm.confirm({
      heading: this.i18n.t('securityCenter.alerts.confirm.resolveTitle', { title: this.title(alert) }),
      message: this.i18n.t('securityCenter.alerts.confirm.resolveBody'),
      details: [this.i18n.t('securityCenter.alerts.confirm.resolveReopen')],
      confirmLabel: this.i18n.t('securityCenter.alerts.resolve'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'warning',
      action: () => this.api.resolve(alert.id).pipe(tap((result) => (updated = result))),
    });
    return done ? updated : null;
  }

  private title(alert: SecurityAlert): string {
    return this.i18n.pick(alert.title.ar, alert.title.en);
  }
}
