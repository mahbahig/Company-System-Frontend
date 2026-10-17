import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Camera, KeyRound, MonitorSmartphone, RefreshCw, ShieldCheck, UserRound } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DetailItemComponent } from '../../../shared/crm/detail-item/detail-item.component';
import { SessionListComponent } from '../../../shared/crm/session-list/session-list.component';
import type { UserSession } from '../../../shared/crm/session-list/user-session.interface';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../account-api.service';
import { ChangePasswordFormComponent } from '../password/change-password-form.component';
import { TwoFactorSettingComponent } from '../security/two-factor-setting.component';
import { ProfilePictureCardComponent } from './profile-picture-card.component';

/**
 * `/account/profile` — the signed-in user's own profile, the same page for
 * every role (the Super Administrator included):
 * - Profile picture: shown to other signed-in employees; changed or removed here;
 * - Account: who they are, from `/auth/me` (no credential of any kind is in it);
 * - Change password: current + new + confirmation; every other session ends,
 *   this one stays signed in;
 * - Two-factor sign-in: one switch (codes e-mailed to their own address);
 * - Active sessions: their own sessions, this one first and marked "Current
 *   session" (it has no Log out — Sign out does that), each other one with
 *   Log out. There is deliberately no "log out all sessions" here. The API
 *   decides all of it; the page only reflects it.
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    TranslatePipe,
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonDirective,
    DetailItemComponent,
    IconComponent,
    SessionListComponent,
    ChangePasswordFormComponent,
    ProfilePictureCardComponent,
    TwoFactorSettingComponent,
    ...CARD_IMPORTS,
  ],
  templateUrl: './profile.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ProfilePage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly sessionActions = new ActionRunner(this.i18n);

  protected readonly icons = { account: UserRound, password: KeyRound, sessions: MonitorSmartphone, security: ShieldCheck, refresh: RefreshCw, picture: Camera };

  protected readonly user = this.auth.user;
  protected readonly name = computed(() => {
    const user = this.user();
    return user ? this.i18n.pick(user.fullNameAr, user.fullNameEn) : '';
  });
  protected readonly jobTitle = computed(() => {
    const user = this.user();
    return user ? this.i18n.pick(user.jobTitleAr ?? '', user.jobTitleEn ?? '') : '';
  });
  protected readonly teams = computed(() =>
    (this.user()?.teams ?? []).map((team) => this.i18n.pick(team.nameAr, team.nameEn)).join(this.i18n.locale() === 'ar' ? '، ' : ', '),
  );
  protected readonly manager = computed(() => {
    const manager = this.user()?.manager;
    return manager ? this.i18n.pick(manager.fullNameAr, manager.fullNameEn) : '';
  });

  protected readonly sessions = rxResource({ stream: () => this.api.sessions() });
  protected readonly revoking = signal<string | null>(null);
  protected readonly otherSessions = computed(() => (this.sessions.value() ?? []).filter((session) => !session.current).length);

  protected async revoke(session: UserSession): Promise<void> {
    const device = `${session.os ?? this.i18n.t('sessions.unknownOs')} · ${session.browser ?? this.i18n.t('sessions.unknownBrowser')}`;
    this.revoking.set(session.id);
    const revoked = await this.confirm.confirm({
      heading: this.i18n.t('sessions.confirm.oneTitle'),
      message: this.i18n.t('sessions.confirm.oneOwnBody', { device }),
      details: [this.i18n.t('sessions.confirm.ownKeepsOthers')],
      confirmLabel: this.i18n.t('sessions.confirm.revokeSession'),
      cancelLabel: this.i18n.t('sessions.confirm.cancel'),
      variant: 'danger',
      action: () => this.api.revokeSession(session.id),
    });
    this.revoking.set(null);
    if (!revoked) return;
    this.sessionActions.message.set(this.i18n.t('sessions.notices.loggedOutOne'));
    this.sessions.reload();
  }

  /** After a password change the other sessions are gone: show the list as it now is. */
  protected passwordChanged(): void {
    this.sessions.reload();
  }
}
