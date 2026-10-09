import { Component, computed, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AlertCircle, Eye, EyeOff, LoaderCircle, Lock, Mail, Sun } from 'lucide';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import type { CurrentUser } from '../../../core/auth/models/current-user.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LocaleSwitcherComponent } from '../../../core/layout/locale-switcher/locale-switcher.component';
import { ThemeToggleComponent } from '../../../core/layout/theme-toggle/theme-toggle.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import type { LoginModel } from './login-model.interface';
import type { LoginNotice } from './login-notice.interface';

const NOTICES: Record<string, LoginNotice> = {
  signed_out: { key: 'auth.login.signedOutNotice', variant: 'default' },
  password_changed: { key: 'account.password.signInAgain', variant: 'default' },
  signin_required: { key: 'auth.login.sessionExpiredNotice', variant: 'default' },
  account_inactive: { key: 'auth.errors.accountInactive', variant: 'destructive' },
};

/**
 * Same functionality as the Next login page (fields, validation, notices,
 * redirect logic) behind a more editorial presentation: a branded panel on
 * wide screens, a glass-effect form card, and icon-led inputs. Collapses to
 * the same single-column centred form on mobile.
 */
@Component({
  selector: 'app-login-page',
  imports: [FormField, RouterLink, TranslatePipe, AlertComponent, ButtonDirective, InputDirective, LabelComponent, IconComponent, ThemeToggleComponent, LocaleSwitcherComponent],
  templateUrl: './login.page.html',
  host: { class: 'relative flex min-h-dvh flex-col lg:flex-row' },
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** Query params (component input binding). */
  readonly reason = input<string>();
  readonly returnTo = input<string>();

  protected readonly sunIcon = Sun;
  protected readonly mailIcon = Mail;
  protected readonly lockIcon = Lock;
  protected readonly eyeIcon = Eye;
  protected readonly eyeOffIcon = EyeOff;
  protected readonly showPassword = signal(false);
  protected readonly alertIcon = AlertCircle;
  protected readonly spinnerIcon = LoaderCircle;
  protected readonly environmentBadge = environment.environmentBadge;

  protected readonly errorKey = signal<string | null>(null);
  protected readonly mfaToken = signal<string | null>(null);
  protected readonly mfaCode = signal('');
  protected readonly verifying = signal(false);
  protected readonly notice = computed(() => NOTICES[this.reason() ?? ''] ?? null);

  private readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email, { message: 'auth.validation.emailRequired' });
    email(path.email, { message: 'auth.validation.emailInvalid' });
    required(path.password, { message: 'auth.validation.passwordRequired' });
  });

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

  protected cancelMfa(): void {
    this.mfaToken.set(null);
    this.mfaCode.set('');
    this.errorKey.set(null);
  }

  private destination(user: CurrentUser): string {
    const locale = this.i18n.locale();
    if (user.mustChangePassword) return `/${locale}/account/password`;
    if (user.mfaRequired && !user.mfaEnabled) return `/${locale}/account/security?enroll=1`;
    const target = this.returnTo();
    // Only same-app paths: never an absolute or protocol-relative URL (open redirect).
    return target && target.startsWith('/') && !target.startsWith('//') ? target : `/${locale}/dashboard`;
  }

  private messageFor(error: unknown): string {
    if (!ApiError.is(error)) return 'auth.errors.unexpected';
    if (error.status === 429) return 'auth.errors.rateLimited';
    return this.i18n.has(error.messageKey) ? error.messageKey : 'auth.errors.unexpected';
  }
}
