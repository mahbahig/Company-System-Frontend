import { DOCUMENT } from '@angular/common';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  DestroyRef,
} from '@angular/core';
import { FormField, form, minLength, pattern, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { LockKeyhole, Mail, ShieldCheck, TriangleAlert } from 'lucide';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { EMAIL_PATTERN } from '../../../core/auth/email-format';
import { PASSWORD_LETTER, PASSWORD_MIN_LENGTH } from '../../../core/auth/password-policy';
import { SessionExpiry } from '../../../core/auth/session-expiry.service';
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

/** Why the user is here (`?reason=`), set when a session ended without them signing out (`SessionExpiry`). */
const NOTICES: Record<string, LoginNotice> = {
  password_changed: { key: 'account.password.signInAgain', variant: 'default' },
  signin_required: { key: 'auth.login.sessionExpiredNotice', variant: 'default' },
  session_expired: { key: 'auth.login.sessionExpiredNotice', variant: 'default' },
  session_revoked: { key: 'auth.login.sessionRevokedNotice', variant: 'default' },
  password_changed_elsewhere: {
    key: 'auth.login.passwordChangedElsewhereNotice',
    variant: 'default',
  },
  account_inactive: { key: 'auth.errors.accountInactive', variant: 'destructive' },
  system_locked: { key: 'auth.login.systemLockedNotice', variant: 'warning' },
};

/** The API's sign-in field errors, as this form's own messages. */
const SERVER_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  'validation.passwordTooShort': 'auth.validation.passwordTooShort',
  'validation.passwordLetterRequired': 'auth.validation.passwordLetterRequired',
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
  private readonly expiry = inject(SessionExpiry);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Query params (component input binding). */
  readonly reason = input<string>();
  readonly returnTo = input<string>();

  protected readonly mailIcon = Mail;
  protected readonly lockIcon = LockKeyhole;
  protected readonly secureIcon = ShieldCheck;
  protected readonly warningIcon = TriangleAlert;
  protected readonly mfaFieldId = MFA_FIELD_ID;

  protected readonly showPassword = signal(false);
  protected readonly capsLock = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly mfaToken = signal<string | null>(null);
  protected readonly mfaCode = signal('');
  /** Second step: where the e-mailed code went (masked) and when another may be asked for. */
  protected readonly mfaDestination = signal('');
  protected readonly resendAvailableAt = signal<number>(0);
  private readonly now = signal(Date.now());
  protected readonly resendIn = computed(() =>
    Math.max(0, Math.ceil((this.resendAvailableAt() - this.now()) / 1000)),
  );
  protected readonly resending = signal(false);
  protected readonly resentNotice = signal(false);
  protected readonly verifying = signal(false);
  protected readonly notice = computed(() => NOTICES[this.reason() ?? ''] ?? null);
  /** The notice's words — naming the Super Administrator who locked the system when this browser heard it from the realtime event (never from the URL). */
  protected readonly noticeText = computed(() => {
    const notice = this.notice();
    if (!notice) return '';
    const ended = this.expiry.lastNotice();
    if (this.reason() === 'system_locked' && ended?.reason === 'system_locked' && ended.actorName) return this.i18n.t('auth.login.systemLockedByNotice', { name: ended.actorName });
    return this.i18n.t(notice.key);
  });

  private readonly model = signal<LoginModel>({ email: '', password: '' });
  /**
   * Checked before anything is sent, one message per field (the first that
   * applies): required → a real e-mail address; required → the password
   * policy (6+ characters with a letter). A well-formed but wrong password is
   * the API's answer, never a field message (no hint whether the account exists).
   */
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'auth.validation.emailRequired' });
    pattern(path.email, EMAIL_PATTERN, { message: 'auth.validation.emailInvalid' });
    required(path.password, { message: 'auth.validation.passwordRequired' });
    minLength(path.password, PASSWORD_MIN_LENGTH, { message: 'auth.validation.passwordTooShort' });
    pattern(path.password, PASSWORD_LETTER, { message: 'auth.validation.passwordLetterRequired' });
  });
  /** The API's own field errors from the last attempt, each shown until that field is changed. */
  private readonly serverErrors = signal<Partial<Record<keyof LoginModel, { message: string; value: string }>>>({});

  /** Caps-lock awareness on the password field — a small premium login cue. */
  protected onCapsLock(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState('CapsLock'));
  }

  /** The field's message: its own first error once touched (or submitted), else what the API said about it. */
  protected fieldError(field: keyof LoginModel): string | null {
    const state = this.loginForm[field]();
    const own = state.touched() ? (state.errors()[0]?.message ?? null) : null;
    if (own) return own;
    const server = this.serverErrors()[field];
    return server && server.value === this.model()[field] ? server.message : null;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorKey.set(null);
    this.serverErrors.set({});
    // Reveal every field's error on submit, even for fields never focused (an invalid form sends nothing).
    this.loginForm().markAsTouched();
    await submit(this.loginForm, async () => {
      try {
        const result = await this.auth.login(this.model());
        if ('mfaToken' in result) {
          this.mfaToken.set(result.mfaToken);
          this.mfaDestination.set(result.destination);
          this.resendAvailableAt.set(new Date(result.resendAvailableAt).getTime());
          this.startTicker();
          this.focusMfaField();
          return undefined;
        }
        await this.router.navigateByUrl(this.destination(result));
      } catch (error) {
        const fields = this.fieldErrorsFrom(error);
        this.serverErrors.set(fields);
        this.errorKey.set(Object.keys(fields).length ? null : this.messageFor(error));
      }
      return undefined;
    });
  }

  /** AUTH-06 second step: the code e-mailed to the account's own address. */
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

  /** Another e-mailed code (the API enforces the wait and the hourly limit). */
  protected async resend(): Promise<void> {
    const token = this.mfaToken();
    if (!token || this.resending() || this.resendIn() > 0) return;
    this.errorKey.set(null);
    this.resentNotice.set(false);
    this.resending.set(true);
    try {
      const sent = await this.auth.resendMfa(token);
      this.mfaDestination.set(sent.destination);
      this.resendAvailableAt.set(new Date(sent.resendAvailableAt).getTime());
      this.mfaCode.set('');
      this.resentNotice.set(true);
      this.focusMfaField();
    } catch (error) {
      this.errorKey.set(this.messageFor(error));
    } finally {
      this.resending.set(false);
    }
  }

  protected cancelMfa(): void {
    this.mfaToken.set(null);
    this.mfaCode.set('');
    this.mfaDestination.set('');
    this.resentNotice.set(false);
    this.errorKey.set(null);
  }

  /** Counts down to the next allowed resend while the second step is open. */
  private startTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(this.ticker));
  }
  private ticker: ReturnType<typeof setInterval> | undefined;

  /** Moves focus to the second-step input once it has rendered. */
  private focusMfaField(): void {
    afterNextRender(() => this.document.getElementById(MFA_FIELD_ID)?.focus(), {
      injector: this.injector,
    });
  }

  private destination(user: CurrentUser): string {
    if (user.mustChangePassword) return '/account/password';
    if (user.mfaRequired && !user.mfaEnabled) return '/account/security?enroll=1';
    const target = this.returnTo();
    // Only same-app paths: never an absolute or protocol-relative URL (open redirect).
    return target && target.startsWith('/') && !target.startsWith('//')
      ? target
      : '/dashboard';
  }

  /** The API's validation errors for the e-mail / password, as this form's messages (never raw server text). */
  private fieldErrorsFrom(error: unknown): Partial<Record<keyof LoginModel, { message: string; value: string }>> {
    if (!ApiError.is(error) || error.status !== 400) return {};
    const found: Partial<Record<keyof LoginModel, { message: string; value: string }>> = {};
    for (const field of ['email', 'password'] as const) {
      const key = error.fieldErrors[field];
      if (!key) continue;
      const message = key === 'validation.required' ? `auth.validation.${field}Required` : (SERVER_FIELD_MESSAGES[key] ?? (field === 'email' ? 'auth.validation.emailInvalid' : 'auth.validation.passwordTooShort'));
      found[field] = { message, value: this.model()[field] };
    }
    return found;
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'auth.errors.unexpected';
    if (error.status === 429) return 'auth.errors.rateLimited';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'auth.errors.unexpected';
  }
}
