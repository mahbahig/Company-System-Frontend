import { Component, computed, inject, output, signal } from '@angular/core';
import { Check, Eye, EyeOff } from 'lucide';

import { PASSWORD_LETTER, PASSWORD_MIN_LENGTH } from '../../../core/auth/password-policy';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../account-api.service';

type PasswordField = 'current' | 'password' | 'confirm';

/**
 * AUTH-02 change password — the form the Profile page and the forced
 * first-login page share: current password, new password and confirmation
 * (all required, each with show / hide), the policy as a live checklist (the
 * same rule the API applies: 6+ characters with a letter) and
 * the API's own verdict (a wrong current password, a weak one) shown in words.
 * The passwords live only in this form and go only into the request body;
 * after success they are cleared and `changed` fires.
 */
@Component({
  selector: 'app-change-password-form',
  imports: [TranslatePipe, SaveShortcutDirective, AlertComponent, ButtonDirective, IconComponent, ...FORM_IMPORTS],
  templateUrl: './change-password-form.component.html',
})
export class ChangePasswordFormComponent {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  /** The password was changed (every other session of the user has ended). */
  readonly changed = output<void>();

  protected readonly checkIcon = Check;
  protected readonly showIcon = Eye;
  protected readonly hideIcon = EyeOff;
  protected readonly fields: ReadonlyArray<{ key: PasswordField; label: string }> = [
    { key: 'current', label: 'account.password.current' },
    { key: 'password', label: 'account.password.new' },
    { key: 'confirm', label: 'account.password.confirm' },
  ];

  protected readonly current = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly visible = signal<Record<PasswordField, boolean>>({ current: false, password: false, confirm: false });

  /** The API's policy (`passwordPolicyError`): 6+ characters with a letter; plus the confirmation. */
  protected readonly rules = computed(() => {
    const value = this.password();
    return [
      { key: 'length', label: 'account.password.ruleLength', met: value.length >= PASSWORD_MIN_LENGTH },
      { key: 'letter', label: 'account.password.ruleLetter', met: PASSWORD_LETTER.test(value) },
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
    void this.actions.run(this.api.changePassword({ currentPassword: this.current(), newPassword: this.password(), confirmPassword: this.confirm() }), 'account.password.changedHere', () => {
      for (const field of [this.current, this.password, this.confirm]) field.set('');
      this.visible.set({ current: false, password: false, confirm: false });
      this.changed.emit();
    });
  }
}
