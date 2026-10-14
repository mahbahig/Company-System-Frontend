import { DOCUMENT } from '@angular/common';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { KeyRound, LockKeyhole, Mail, ShieldCheck, TriangleAlert } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import type { CurrentUser } from '../../../core/auth/models/current-user.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { AuthButtonComponent } from '../shared/auth-button.component';
import { AuthFieldComponent } from '../shared/auth-field.component';
import { AuthHeadingComponent } from '../shared/auth-heading.component';
import { AuthInputDirective } from '../shared/auth-input.directive';
import { AuthLinkDirective } from '../shared/auth-link.directive';
import { AuthNoticeComponent } from '../shared/auth-notice.component';
import { OtpInputComponent } from '../shared/otp-input.component';
import { PasswordToggleComponent } from '../shared/password-toggle.component';
import type { LoginModel } from './login-model.interface';
import type { LoginNotice } from './login-notice.interface';

const NOTICES: Record<string, LoginNotice> = {
  password_changed: { key: 'account.password.signInAgain', variant: 'default' },
  signin_required: { key: 'auth.login.sessionExpiredNotice', variant: 'default' },
  account_inactive: { key: 'auth.errors.accountInactive', variant: 'destructive' },
};

/** Id of the second-step input, whichever form it takes. */
const MFA_FIELD_ID = 'mfa-code';

/**
 * Same functionality as the Next login page (fields, validation, notices,
 * redirect logic, AUTH-06 second step) on the shared sign-in layout. The
 * second step takes the authenticator code in digit cells, with a switch to
 * a plain field for the `xxxxx-xxxxx` recovery codes.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    FormField,
    RouterLink,
    TranslatePipe,
    IconComponent,
    LabelComponent,
    AuthHeadingComponent,
    AuthFieldComponent,
    AuthInputDirective,
    AuthButtonComponent,
    AuthLinkDirective,
    AuthNoticeComponent,
    OtpInputComponent,
    PasswordToggleComponent,
  ],
  templateUrl: './login.page.html',
  host: { class: 'block' },
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Query params (component input binding). */
  readonly reason = input<string>();
  readonly returnTo = input<string>();

  protected readonly mailIcon = Mail;
  protected readonly lockIcon = LockKeyhole;
  protected readonly secureIcon = ShieldCheck;
  protected readonly recoveryIcon = KeyRound;
  protected readonly warningIcon = TriangleAlert;
  protected readonly mfaFieldId = MFA_FIELD_ID;

  protected readonly showPassword = signal(false);
  protected readonly capsLock = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly mfaToken = signal<string | null>(null);
  protected readonly mfaCode = signal('');
  /** Second step: authenticator code (digit cells) or a one-time recovery code. */
  protected readonly useRecoveryCode = signal(false);
  protected readonly verifying = signal(false);
  protected readonly notice = computed(() => NOTICES[this.reason() ?? ''] ?? null);

  private readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'auth.validation.emailRequired' });
    email(path.email, { message: 'auth.validation.emailInvalid' });
    required(path.password, { message: 'auth.validation.passwordRequired' });
  });

  /** Caps-lock awareness on the password field — a small premium login cue. */
  protected onCapsLock(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState('CapsLock'));
  }

  /** First error key of a field, shown once the field was touched (or the form submitted). */
  protected fieldError(field: 'email' | 'password'): string | null {
    const state = this.loginForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? null) : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    // Reveal every field's error on submit, even for fields never focused.
    this.loginForm().markAsTouched();
    await submit(this.loginForm, async () => {
      try {
        const result = await this.auth.login(this.model());
        if ('mfaToken' in result) {
          this.mfaToken.set(result.mfaToken);
          this.focusMfaField();
          return undefined;
        }
        await this.router.navigateByUrl(this.destination(result));
      } catch (error) {
        this.errorKey.set(this.messageFor(error));
      }
      return undefined;
    });
  }

  /** AUTH-06 second step: TOTP or recovery code. */
  protected async onVerify(event: Event): Promise<void> {
    event.preventDefault();
    const token = this.mfaToken();
    if (!token || this.verifying()) return;
    this.errorKey.set(null);
    this.verifying.set(true);
    try {
      const user = await this.auth.verifyMfa(token, this.mfaCode().trim());
      await this.router.navigateByUrl(this.destination(user));
    } catch (error) {
      this.errorKey.set(this.messageFor(error));
    } finally {
      this.verifying.set(false);
    }
  }

  protected toggleRecoveryCode(): void {
    this.useRecoveryCode.update((recovery) => !recovery);
    this.mfaCode.set('');
    this.errorKey.set(null);
    this.focusMfaField();
  }

  protected cancelMfa(): void {
    this.mfaToken.set(null);
    this.mfaCode.set('');
    this.useRecoveryCode.set(false);
    this.errorKey.set(null);
  }

  /** Moves focus to the second-step input once it has rendered. */
  private focusMfaField(): void {
    afterNextRender(() => this.document.getElementById(MFA_FIELD_ID)?.focus(), {
      injector: this.injector,
    });
  }

  private destination(user: CurrentUser): string {
    const locale = this.i18n.locale();
    if (user.mustChangePassword) return `/${locale}/account/password`;
    if (user.mfaRequired && !user.mfaEnabled) return `/${locale}/account/security?enroll=1`;
    const target = this.returnTo();
    // Only same-app paths: never an absolute or protocol-relative URL (open redirect).
    return target && target.startsWith('/') && !target.startsWith('//')
      ? target
      : `/${locale}/dashboard`;
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'auth.errors.unexpected';
    if (error.status === 429) return 'auth.errors.rateLimited';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'auth.errors.unexpected';
  }
}
