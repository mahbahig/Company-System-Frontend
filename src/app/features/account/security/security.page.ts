import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ShieldCheck } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TwoFactorSettingComponent } from './two-factor-setting.component';

/**
 * AUTH-06 two-factor sign-in on its own page — centred like the password
 * page — above all for the roles that must switch it on before working
 * (`?enroll=1`; the API lets them call nothing else meanwhile). Everyone
 * else manages the same switch on their profile. Codes go by e-mail to the
 * account's own address; there is no authenticator app.
 */
@Component({
  selector: 'app-security-page',
  imports: [TranslatePipe, AlertComponent, IconComponent, TwoFactorSettingComponent, ...CARD_IMPORTS],
  templateUrl: './security.page.html',
  host: { class: 'flex flex-col' },
})
export class SecurityPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly icon = ShieldCheck;
  protected readonly mustEnroll = computed(() => !!this.auth.user()?.mfaRequired && !this.auth.user()?.mfaEnabled);

  /** Once switched on, someone who had to enrol carries on to their work. */
  protected async enabled(): Promise<void> {
    if (this.auth.user()?.mfaRequired) await this.router.navigate(['/', 'dashboard']);
  }
}
