import { Component, computed, inject, input, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../account-api.service';

/**
 * AUTH-06 two-factor sign-in (TOTP): set up with an authenticator app,
 * confirm with a code, keep the one-time recovery codes; disable with the
 * password plus a code. Roles listed in `auth.mfaRequiredRoles` land here
 * until they enrol.
 */
@Component({
  selector: 'app-security-page',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  templateUrl: './security.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SecurityPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly enroll = input<string>();

  protected readonly enabled = computed(() => !!this.auth.user()?.mfaEnabled);
  protected readonly mustEnroll = computed(() => !!this.auth.user()?.mfaRequired && !this.enabled());
  protected readonly setup = signal<{ secret: string; otpauthUrl: string } | null>(null);
  protected readonly recoveryCodes = signal<string[] | null>(null);
  protected readonly code = signal('');
  protected readonly password = signal('');

  protected start(): void {
    void this.actions.run(this.api.setupMfa(), null, (result) => this.setup.set(result));
  }

  protected enable(): void {
    void this.actions.run(this.api.enableMfa(this.code().trim()), 'account.mfa.enabledNotice', (result) => {
      this.recoveryCodes.set(result.recoveryCodes);
      this.setup.set(null);
      this.code.set('');
      void this.auth.loadProfile();
    });
  }

  protected disable(): void {
    void this.actions.run(this.api.disableMfa(this.password(), this.code().trim()), 'account.mfa.disabledNotice', () => {
      this.password.set('');
      this.code.set('');
      this.recoveryCodes.set(null);
      void this.auth.loadProfile();
    });
  }
}
