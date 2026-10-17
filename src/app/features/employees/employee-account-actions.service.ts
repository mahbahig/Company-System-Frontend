import { Service, inject } from '@angular/core';
import { tap } from 'rxjs';

import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { AdminApi, type AdminUser } from '../admin/admin-api.service';

type Person = Pick<AdminUser, 'id' | 'fullNameAr' | 'fullNameEn'>;

/**
 * The Super Administrator's account actions on an employee, the same from the
 * Employees list and the employee's page: each asks a contextual
 * confirmation (whose account, what happens, named after the action), runs
 * inside it — the dialog stays open, busy, until the API answers — and
 * resolves only after the API succeeded. The API refuses all of them for a
 * Super Administrator's account, whatever the UI shows.
 */
@Service()
export class EmployeeAccountActions {
  private readonly api = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  /** A temporary password, every session ended, a forced change at the next sign-in. Resolves the temporary password (null: cancelled). */
  async resetPassword(user: Person): Promise<string | null> {
    const name = this.name(user);
    let temporaryPassword: string | null = null;
    const done = await this.confirm.confirm({
      heading: this.t('admin.users.confirm.resetTitle', name),
      message: this.t('admin.users.confirm.resetBody', name),
      details: [this.t('admin.users.confirm.resetSessions', name), this.t('admin.users.confirm.resetNextSignIn', name), this.t('admin.users.confirm.resetShownOnce', name)],
      confirmLabel: this.t('admin.users.confirm.resetAction', name),
      cancelLabel: this.t('crm.common.cancel', name),
      variant: 'warning',
      action: () => this.api.resetPassword(user.id).pipe(tap((result) => (temporaryPassword = result.temporaryPassword))),
    });
    return done ? temporaryPassword : null;
  }

  /** Every session of the employee ends — the one they are using included. */
  logOutEverywhere(user: Person): Promise<boolean> {
    const name = this.name(user);
    return this.confirm.confirm({
      heading: this.t('admin.users.confirm.logoutTitle', name),
      message: this.t('admin.users.confirm.logoutBody', name),
      details: [this.t('admin.users.confirm.logoutAgain', name)],
      confirmLabel: this.t('admin.users.confirm.logoutAction', name),
      cancelLabel: this.t('crm.common.cancel', name),
      variant: 'danger',
      action: () => this.api.revokeAllUserSessions(user.id),
    });
  }

  /** A deactivated employee may sign in again. */
  activate(user: Person): Promise<boolean> {
    const name = this.name(user);
    return this.confirm.confirm({
      heading: this.t('admin.users.confirm.activateTitle', name),
      message: this.t('admin.users.confirm.activateBody', name),
      confirmLabel: this.t('admin.users.confirm.activateAction', name),
      cancelLabel: this.t('crm.common.cancel', name),
      variant: 'default',
      action: () => this.api.activate(user.id),
    });
  }

  private name(user: Person): string {
    return this.i18n.pick(user.fullNameAr, user.fullNameEn);
  }

  private t(key: string, name: string): string {
    return this.i18n.t(key, { name });
  }
}
