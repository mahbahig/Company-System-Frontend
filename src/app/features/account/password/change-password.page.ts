import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeyRound, ShieldCheck } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ChangePasswordFormComponent } from './change-password-form.component';

/**
 * AUTH-02 change password on its own page — above all the forced first-login
 * step when `mustChangePassword` is set (the Profile page carries the same
 * form for everyone else). A centred, focused composition: what the page
 * does, the form, and what happens next (every other session is signed out;
 * this one stays). After a forced change the user continues to the dashboard.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [TranslatePipe, AlertComponent, IconComponent, ChangePasswordFormComponent, ...CARD_IMPORTS],
  templateUrl: './change-password.page.html',
  host: { class: 'flex flex-col' },
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly keyIcon = KeyRound;
  protected readonly shieldIcon = ShieldCheck;
  protected readonly forced = computed(() => !!this.auth.user()?.mustChangePassword);

  /** The session stays signed in: refresh the profile (the forced-change flag is gone) and carry on. */
  protected async changed(): Promise<void> {
    const wasForced = this.forced();
    await this.auth.loadProfile().catch(() => undefined);
    if (wasForced) await this.router.navigate(['/', 'dashboard']);
  }
}
