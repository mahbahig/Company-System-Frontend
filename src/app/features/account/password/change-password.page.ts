import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../account-api.service';

type PasswordField = 'current' | 'password' | 'confirm';

/**
 * AUTH-02 change password (the current password is re-verified). Also the
 * forced first-login step when `mustChangePassword` is set.
 *
 * A centred, focused composition: what the page does, the three fields with
 * show / hide, the policy shown as a live checklist (the same rule the API
 * applies: 12+ characters with a letter and a digit), and what happens next
 * (every session is signed out).
 */
@Component({
  selector: 'app-change-password-page',
  imports: [TranslatePipe, SaveShortcutDirective, AlertComponent, ButtonDirective, IconComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './change-password.page.html',
  host: { class: 'flex flex-col' },
})
export class ChangePasswordPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly keyIcon = KeyRound;
  protected readonly shieldIcon = ShieldCheck;
  protected readonly checkIcon = Check;
  protected readonly showIcon = Eye;
  protected readonly hideIcon = EyeOff;
  protected readonly fields: ReadonlyArray<{ key: PasswordField; label: string }> = [
    { key: 'current', label: 'account.password.current' },
    { key: 'password', label: 'account.password.new' },
    { key: 'confirm', label: 'account.password.confirm' },
  ];

  protected readonly forced = computed(() => !!this.auth.user()?.mustChangePassword);
  protected readonly current = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly visible = signal<Record<PasswordField, boolean>>({ current: false, password: false, confirm: false });

  /** The API's policy (`passwordPolicyError`): 12+ characters, a letter and a digit; plus the confirmation. */
  protected readonly rules = computed(() => {
    const value = this.password();
    return [
      { key: 'length', label: 'account.password.ruleLength', met: value.length >= 12 },
      { key: 'letter', label: 'account.password.ruleLetter', met: /[A-Za-z؀-ۿ]/.test(value) },
      { key: 'number', label: 'account.password.ruleNumber', met: /[0-9]/.test(value) },
      { key: 'match', label: 'ux.password.ruleMatch', met: !!value && value === this.confirm() },
    ];
  });
  protected readonly mismatch = computed(() => !!this.confirm() && this.confirm() !== this.password());
  protected readonly ready = computed(() => !!this.current() && this.rules().every((rule) => rule.met));

  protected value(field: PasswordField): string {
    return field === 'current' ? this.current() : field === 'password' ? this.password() : this.confirm();
  }

  protected setValue(field: PasswordField, value: string): void {
    (field === 'current' ? this.current : field === 'password' ? this.password : this.confirm).set(value);
  }

  protected toggle(field: PasswordField): void {
    this.visible.update((state) => ({ ...state, [field]: !state[field] }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (!this.ready() || this.actions.busy()) return;
    void this.actions.run(this.api.changePassword({ currentPassword: this.current(), newPassword: this.password(), confirmPassword: this.confirm() }), null, async () => {
      // The API signs out every session (all devices) after a password change.
      this.auth.endSession();
      await this.router.navigate(['/', this.i18n.locale(), 'login'], { queryParams: { reason: 'password_changed' } });
    });
  }
}
