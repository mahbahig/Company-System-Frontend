import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { ShieldCheck, ShieldOff } from 'lucide';
import { firstValueFrom, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import type { MfaCodeSent } from '../../../core/auth/models/mfa-challenge.interface';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { requestErrorText } from '../../../shared/utils/request-error-text';
import { AccountApi } from '../account-api.service';

/**
 * Two-factor sign-in as a single switch (AUTH-06). With it on, every sign-in
 * also asks for a one-time code e-mailed to the account's own address.
 *
 * - Switching on e-mails a code first; entering it confirms the change, so
 *   two-factor is only ever on for someone who actually receives the codes.
 * - Switching off asks for the current password.
 * - While the user's role makes it mandatory, the switch stays on.
 *
 * The API decides every step; the code is never shown or kept here.
 */
@Component({
  selector: 'app-two-factor-setting',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent, ...FORM_IMPORTS],
  templateUrl: './two-factor-setting.component.html',
})
export class TwoFactorSettingComponent {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  /** Two-factor sign-in was switched on (the enrolment page continues from here). */
  readonly enabled = output<void>();

  protected readonly icons = { on: ShieldCheck, off: ShieldOff };
  protected readonly isOn = computed(() => !!this.auth.user()?.mfaEnabled);
  protected readonly mandatory = computed(() => !!this.auth.user()?.mfaRequired);
  /** `confirm-on`: a code was e-mailed; `confirm-off`: the password is asked. */
  protected readonly step = signal<'idle' | 'confirm-on' | 'confirm-off'>('idle');
  protected readonly sent = signal<MfaCodeSent | null>(null);
  protected readonly code = signal('');
  protected readonly password = signal('');
  private readonly now = signal(Date.now());
  protected readonly resendIn = computed(() => {
    const at = this.sent()?.resendAvailableAt;
    return at ? Math.max(0, Math.ceil((new Date(at).getTime() - this.now()) / 1000)) : 0;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected toggle(): void {
    if (this.actions.busy()) return;
    this.actions.error.set(null);
    this.actions.message.set(null);
    if (this.isOn()) {
      if (this.mandatory()) return;
      this.password.set('');
      this.step.set('confirm-off');
      return;
    }
    void this.submit(this.api.requestMfaEnable(), null, 'code', async (sent) => {
      this.sent.set(sent);
      this.code.set('');
      this.step.set('confirm-on');
    });
  }

  /** Digits only, at most six (what an e-mailed code is). */
  protected setCode(value: string): void {
    this.code.set(value.replace(/[^0-9]/g, '').slice(0, 6));
  }

  protected resend(): void {
    if (this.resendIn() > 0 || this.actions.busy()) return;
    void this.submit(this.api.resendMfaEnable(), 'account.mfa.codeResent', 'code', async (sent) => this.sent.set(sent));
  }

  protected confirmOn(event: Event): void {
    event.preventDefault();
    if (!/^\d{6}$/.test(this.code().trim()) || this.actions.busy()) return;
    void this.submit(this.api.confirmMfaEnable(this.code().trim()), 'account.mfa.enabledNotice', 'code', async () => {
      this.reset();
      await this.auth.loadProfile().catch(() => undefined);
      this.enabled.emit();
    });
  }

  protected confirmOff(event: Event): void {
    event.preventDefault();
    if (!this.password() || this.actions.busy()) return;
    void this.submit(this.api.disableMfa(this.password()), 'account.mfa.disabledNotice', 'password', async () => {
      this.reset();
      await this.auth.loadProfile().catch(() => undefined);
    });
  }

  protected cancel(): void {
    this.reset();
    this.actions.error.set(null);
  }

  /** Runs one step, showing the field's own error (a wrong code, a wrong password) rather than a generic one. */
  private async submit<T>(request: Observable<T>, successKey: string | null, field: string, after: (result: T) => Promise<void>): Promise<void> {
    this.actions.busy.set(true);
    this.actions.error.set(null);
    this.actions.message.set(null);
    try {
      const result = await firstValueFrom(request);
      await after(result);
      if (successKey) this.actions.message.set(this.i18n.t(successKey));
    } catch (error) {
      this.actions.error.set(requestErrorText(this.i18n, error, field));
    } finally {
      this.actions.busy.set(false);
    }
  }

  private reset(): void {
    this.step.set('idle');
    this.sent.set(null);
    this.code.set('');
    this.password.set('');
  }
}
