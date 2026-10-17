import { Component, computed, inject, input } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Lock, LockOpen, Power, Wrench } from 'lucide';
import { tap } from 'rxjs';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MaintenanceService } from '../../../core/maintenance/maintenance.service';
import { SystemLockChanges } from '../../../core/realtime/system-lock-changes.service';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AdminApi } from '../admin-api.service';
import { SecurityApi, type SystemHealthStatus, type SystemMode, type SystemState } from '../security/security-api.service';

/** How each mode reads: its dot / text colour and words. */
const MODE_TONE: Record<SystemMode, { dot: string; text: string }> = {
  normal: { dot: 'bg-success', text: 'text-success-tint' },
  maintenance: { dot: 'bg-warning', text: 'text-warning-tint' },
  locked: { dot: 'bg-destructive', text: 'text-destructive-tint' },
};

/**
 * System Status (Super Administrators only): how Ecotech is running —
 * Normal, Maintenance Mode or Locked — with its two separate switches:
 * the system lock (only Super Administrators can sign in or stay signed in) and maintenance
 * mode (only Super Administrators can use the application). Each switch asks
 * a contextual confirmation and runs inside it; the API enforces both and
 * refuses this control to everyone else. Optionally shows the overall health.
 * Another Super Administrator's lock or unlock (a realtime event) refreshes it.
 */
@Component({
  selector: 'app-system-status-card',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent, ...CARD_IMPORTS],
  templateUrl: './system-status-card.component.html',
})
export class SystemStatusCardComponent {
  private readonly admin = inject(AdminApi);
  private readonly security = inject(SecurityApi);
  private readonly confirm = inject(ConfirmService);
  private readonly maintenance = inject(MaintenanceService);
  protected readonly i18n = inject(I18nService);
  protected readonly icons = { lock: Lock, unlock: LockOpen, maintenance: Wrench, power: Power };

  /** The overall health, when the page has it (the Security Center). */
  readonly health = input<SystemHealthStatus | null>(null);

  protected readonly state = rxResource({ stream: () => this.security.systemState() });
  protected readonly tone = (mode: SystemMode) => MODE_TONE[mode];
  protected readonly lockChange = computed(() => this.change(this.state.hasValue() ? this.state.value().lock : null, 'lockedBy', 'unlockedBy', (state) => state.locked));
  protected readonly maintenanceChange = computed(() => this.change(this.state.hasValue() ? this.state.value().maintenance : null, 'maintenanceOnBy', 'maintenanceOffBy', (state) => state.enabled));

  constructor() {
    inject(SystemLockChanges)
      .changes$.pipe(takeUntilDestroyed())
      .subscribe(() => this.state.reload());
  }

  protected lock(): Promise<boolean> {
    return this.confirm.confirm({
      heading: this.i18n.t('systemStatus.confirm.lockTitle'),
      message: this.i18n.t('systemStatus.confirm.lockBody'),
      details: [this.i18n.t('systemStatus.confirm.lockSessions'), this.i18n.t('systemStatus.confirm.lockAudit')],
      confirmLabel: this.i18n.t('systemStatus.lock'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'danger',
      action: () => this.admin.lockSystem().pipe(tap((lock) => this.patch({ lock }))),
    });
  }

  protected unlock(): Promise<boolean> {
    return this.confirm.confirm({
      heading: this.i18n.t('systemStatus.confirm.unlockTitle'),
      message: this.i18n.t('systemStatus.confirm.unlockBody'),
      details: [this.i18n.t('systemStatus.confirm.unlockAudit')],
      confirmLabel: this.i18n.t('systemStatus.unlock'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'default',
      action: () => this.admin.unlockSystem().pipe(tap((lock) => this.patch({ lock }))),
    });
  }

  protected enableMaintenance(): Promise<boolean> {
    return this.confirm.confirm({
      heading: this.i18n.t('systemStatus.confirm.maintenanceOnTitle'),
      message: this.i18n.t('systemStatus.confirm.maintenanceOnBody'),
      details: [this.i18n.t('systemStatus.confirm.maintenanceOnSessions'), this.i18n.t('systemStatus.confirm.lockAudit')],
      confirmLabel: this.i18n.t('systemStatus.maintenanceOn'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'warning',
      action: () => this.security.enableMaintenance().pipe(tap((maintenance) => this.patch({ maintenance }))),
    });
  }

  protected disableMaintenance(): Promise<boolean> {
    return this.confirm.confirm({
      heading: this.i18n.t('systemStatus.confirm.maintenanceOffTitle'),
      message: this.i18n.t('systemStatus.confirm.maintenanceOffBody'),
      details: [this.i18n.t('systemStatus.confirm.unlockAudit')],
      confirmLabel: this.i18n.t('systemStatus.maintenanceOff'),
      cancelLabel: this.i18n.t('crm.common.cancel'),
      variant: 'default',
      action: () => this.security.disableMaintenance().pipe(tap((maintenance) => this.patch({ maintenance }))),
    });
  }

  /** The API's answer becomes the shown state; the mode follows from both switches (the lock wins). */
  private patch(change: Partial<Pick<SystemState, 'lock' | 'maintenance'>>): void {
    const current = this.state.value();
    if (!current) return;
    const next = { ...current, ...change };
    this.state.set({ ...next, mode: next.lock.locked ? 'locked' : next.maintenance.enabled ? 'maintenance' : 'normal' });
    if (change.maintenance) this.maintenance.setActiveForAdministrator(change.maintenance.enabled);
  }

  private change<T extends { changedAt: string | null; changedBy: { fullNameEn: string; fullNameAr: string } | null }>(state: T | null, onKey: string, offKey: string, isOn: (state: T) => boolean): string | null {
    if (!state?.changedBy || !state.changedAt) return null;
    return this.i18n.t(`systemStatus.${isOn(state) ? onKey : offKey}`, { name: this.i18n.pick(state.changedBy.fullNameAr, state.changedBy.fullNameEn), when: this.i18n.formatDate(state.changedAt, true) });
  }
}
