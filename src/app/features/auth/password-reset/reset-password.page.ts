import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Check, KeyRound, LockKeyhole, ShieldCheck } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../../account/account-api.service';
import { AuthButtonComponent } from '../shared/auth-button.component';
import { AuthFieldComponent } from '../shared/auth-field.component';
import { AuthHeadingComponent } from '../shared/auth-heading.component';
import { AuthInputDirective } from '../shared/auth-input.directive';
import { AuthLinkDirective } from '../shared/auth-link.directive';
import { AuthNoticeComponent } from '../shared/auth-notice.component';
import { AuthResultComponent } from '../shared/auth-result.component';
import { PasswordToggleComponent } from '../shared/password-toggle.component';

/**
 * The API's password policy (AUTH-02): at least 12 characters with a letter
 * (Latin or Arabic) and a digit. Mirrored here only to guide the user as they
 * type — the server stays the authority and its errors are shown as-is.
 */
const PASSWORD_MIN_LENGTH = 12;
const LETTER = /[A-Za-z\u0600-\u06FF]/;
const DIGIT = /[0-9]/;

/** AUTH-02 reset from the e-mailed link (`?token=`); the link is single-use and expires. */
@Component({
  selector: 'app-reset-password-page',
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    AuthHeadingComponent,
    AuthFieldComponent,
    AuthInputDirective,
    AuthButtonComponent,
    AuthLinkDirective,
    AuthNoticeComponent,
    AuthResultComponent,
    PasswordToggleComponent,
  ],
  templateUrl: './reset-password.page.html',
  host: { class: 'block' },
})
export class ResetPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly token = input<string>();
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly done = signal(false);
  protected readonly showNew = signal(false);
  protected readonly showConfirm = signal(false);

  protected readonly recoveryIcon = KeyRound;
  protected readonly lockIcon = LockKeyhole;
  protected readonly checkIcon = Check;
  protected readonly backIcon = ArrowLeft;
  protected readonly doneIcon = ShieldCheck;

  /** Inline hint once the user has typed a confirmation that doesn't match. */
  protected readonly mismatch = computed(
    () => this.confirm().length > 0 && this.password() !== this.confirm(),
  );

  /** Live checklist of the password policy, ticked off as the user types. */
  protected readonly rules = computed(() => {
    const password = this.password();
    return [
      { key: 'account.password.ruleLength', met: password.length >= PASSWORD_MIN_LENGTH },
      { key: 'account.password.ruleLetter', met: LETTER.test(password) },
      { key: 'account.password.ruleNumber', met: DIGIT.test(password) },
    ];
  });

  protected save(event: Event): void {
    event.preventDefault();
    void this.actions.run(
      this.api.resetPassword({
        token: this.token() ?? '',
        newPassword: this.password(),
        confirmPassword: this.confirm(),
      }),
      null,
      () => this.done.set(true),
    );
  }
}
