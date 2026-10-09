import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../../account/account-api.service';

/**
 * AUTH-02 self-service reset request. The answer is the same whether the
 * address exists or not (no account enumeration).
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, ButtonDirective, ...FORM_IMPORTS],
  template: `
    <main id="main-content" class="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
      <h1 class="text-xl font-semibold">{{ 'account.forgot.title' | t }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ 'account.forgot.subtitle' | t }}</p>
      @if (sent()) {
        <app-alert class="mt-6">{{ 'account.forgot.sent' | t }}</app-alert>
      } @else {
        <form class="mt-6 flex flex-col gap-4" (submit)="send($event)">
          @if (actions.error(); as text) {
            <app-alert variant="destructive">{{ text }}</app-alert>
          }
          <div>
            <label appLabel for="fp-email" required>{{ 'auth.login.emailLabel' | t }}</label>
            <input appInput id="fp-email" type="email" autocomplete="username" dir="ltr" [value]="email()" (input)="email.set($any($event.target).value)" />
          </div>
          <button type="submit" appButton [disabled]="actions.busy() || !email().includes('@')">{{ 'account.forgot.submit' | t }}</button>
        </form>
      }
      <a class="mt-6 inline-block text-sm text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'login']">{{ 'account.backToLogin' | t }}</a>
    </main>
  `,
  host: { class: 'flex min-h-dvh items-center justify-center px-4 py-12' },
})
export class ForgotPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly email = signal('');
  protected readonly sent = signal(false);

  protected send(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.forgotPassword(this.email().trim(), this.i18n.locale()), null, () => this.sent.set(true));
  }
}
