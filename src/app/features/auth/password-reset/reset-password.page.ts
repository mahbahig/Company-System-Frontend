import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../../account/account-api.service';

/** AUTH-02 reset from the e-mailed link (`?token=`); the link is single-use and expires. */
@Component({
  selector: 'app-reset-password-page',
  imports: [RouterLink, TranslatePipe, AlertComponent, ButtonDirective, ...FORM_IMPORTS],
  template: `
    <main id="main-content" class="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
      <h1 class="text-xl font-semibold">{{ 'account.reset.title' | t }}</h1>
      @if (done()) {
        <app-alert class="mt-6">{{ 'account.reset.done' | t }}</app-alert>
      } @else if (!token()) {
        <app-alert variant="destructive" class="mt-6">{{ 'account.reset.invalidLink' | t }}</app-alert>
      } @else {
        <form class="mt-6 flex flex-col gap-4" (submit)="save($event)">
          @if (actions.error(); as text) {
            <app-alert variant="destructive">{{ text }}</app-alert>
          }
          <div>
            <label appLabel for="rp-new" required>{{ 'account.password.new' | t }}</label>
            <input appInput id="rp-new" type="password" autocomplete="new-password" dir="ltr" [value]="password()" (input)="password.set($any($event.target).value)" />
            <p class="mt-1 text-xs text-muted-foreground">{{ 'account.password.rules' | t }}</p>
          </div>
          <div>
            <label appLabel for="rp-confirm" required>{{ 'account.password.confirm' | t }}</label>
            <input appInput id="rp-confirm" type="password" autocomplete="new-password" dir="ltr" [value]="confirm()" (input)="confirm.set($any($event.target).value)" />
          </div>
          <button type="submit" appButton [disabled]="actions.busy() || !password() || password() !== confirm()">{{ 'account.reset.submit' | t }}</button>
        </form>
      }
      <a class="mt-6 inline-block text-sm text-primary hover:underline" [routerLink]="['/', i18n.locale(), 'login']">{{ 'account.backToLogin' | t }}</a>
    </main>
  `,
  host: { class: 'flex min-h-dvh items-center justify-center px-4 py-12' },
})
export class ResetPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly token = input<string>();
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly done = signal(false);

  protected save(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.resetPassword({ token: this.token() ?? '', newPassword: this.password(), confirmPassword: this.confirm() }), null, () => this.done.set(true));
  }
}
