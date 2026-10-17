import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LogOut, MonitorSmartphone, RefreshCw } from 'lucide';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SessionListComponent } from '../../shared/crm/session-list/session-list.component';
import type { UserSession } from '../../shared/crm/session-list/user-session.interface';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../shared/ui/card/card.imports';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AdminApi } from '../admin/admin-api.service';

/**
 * An employee's active sessions on their page, for the Super Administrator
 * (`security.view_sessions` to see them, `administration.manage_users` to end
 * one or all — the employee's current session included). The parent shows it
 * only for a normal employee, never for a Super Administrator or the viewer
 * themself; the API refuses those whatever the page does.
 */
@Component({
  selector: 'app-employee-sessions',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent, SessionListComponent, ...CARD_IMPORTS],
  templateUrl: './employee-sessions.component.html',
})
export class EmployeeSessionsComponent {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly userId = input.required<string>();
  /** The employee's display name, for the confirmations. */
  readonly name = input.required<string>();

  protected readonly icons = { sessions: MonitorSmartphone, logOut: LogOut, refresh: RefreshCw };
  protected readonly canRevoke = computed(() => this.auth.can('administration.manage_users'));
  protected readonly sessions = rxResource({ params: () => this.userId(), stream: ({ params }) => this.api.userSessions(params) });
  /** The session being ended, or `all`. */
  protected readonly busy = signal<string | null>(null);

  protected async revoke(session: UserSession): Promise<void> {
    const device = `${session.os ?? this.i18n.t('sessions.unknownOs')} · ${session.browser ?? this.i18n.t('sessions.unknownBrowser')}`;
    this.busy.set(session.id);
    const revoked = await this.confirm.confirm({
      heading: this.i18n.t('sessions.confirm.oneTitle'),
      message: this.i18n.t('sessions.confirm.oneEmployeeBody', { device, name: this.name() }),
      details: [this.i18n.t('sessions.confirm.employeeKeepsOthers', { name: this.name() })],
      confirmLabel: this.i18n.t('sessions.confirm.revokeSession'),
      cancelLabel: this.i18n.t('sessions.confirm.cancel'),
      variant: 'danger',
      action: () => this.api.revokeUserSession(this.userId(), session.id),
    });
    this.busy.set(null);
    if (!revoked) return;
    this.actions.message.set(this.i18n.t('sessions.notices.loggedOutOne'));
    this.sessions.reload();
  }

  protected async revokeAll(): Promise<void> {
    this.busy.set('all');
    const revoked = await this.confirm.confirm({
      heading: this.i18n.t('sessions.confirm.allTitle'),
      message: this.i18n.t('sessions.confirm.allBody', { name: this.name() }),
      details: [this.i18n.t('sessions.confirm.allAgain', { name: this.name() })],
      confirmLabel: this.i18n.t('sessions.confirm.revokeAll'),
      cancelLabel: this.i18n.t('sessions.confirm.cancel'),
      variant: 'danger',
      action: () => this.api.revokeAllUserSessions(this.userId()),
    });
    this.busy.set(null);
    if (!revoked) return;
    this.actions.message.set(this.i18n.t('sessions.notices.loggedOutAll'));
    this.sessions.reload();
  }
}
