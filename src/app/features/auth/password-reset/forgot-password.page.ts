import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, KeyRound, Mail, MailCheck } from 'lucide';

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

/**
 * AUTH-02 self-service reset request, on the shared sign-in layout so it reads
 * as a continuation of sign-in. The answer is the same whether the address
 * exists or not (no account enumeration).
 */
@Component({
  selector: 'app-forgot-password-page',
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
  ],
  templateUrl: './forgot-password.page.html',
  host: { class: 'block' },
})
export class ForgotPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly email = signal('');
  protected readonly sent = signal(false);

  protected readonly recoveryIcon = KeyRound;
  protected readonly mailIcon = Mail;
  protected readonly sentIcon = MailCheck;
  protected readonly backIcon = ArrowLeft;

  protected send(event: Event): void {
    event.preventDefault();
    void this.actions.run(
      this.api.forgotPassword(this.email().trim(), this.i18n.locale()),
      null,
      () => this.sent.set(true),
    );
  }
}
