import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

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
 * AUTH-02 change password (the current password is re-verified). Also the
 * forced first-login step when `mustChangePassword` is set.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <app-page-header [heading]="'account.password.title' | t" [subtitle]="'account.password.subtitle' | t" class="!mb-0" />
    @if (forced()) {
      <app-alert>{{ 'account.password.forced' | t }}</app-alert>
    }
    <form appCard class="max-w-lg" (submit)="save($event)">
      <div appCardContent class="flex flex-col gap-4">
        @if (actions.message(); as text) {
          <app-alert>{{ text }}</app-alert>
        }
        @if (actions.error(); as text) {
          <app-alert variant="destructive">{{ text }}</app-alert>
        }
        <div>
          <label appLabel for="cp-current" required>{{ 'account.password.current' | t }}</label>
          <input appInput id="cp-current" type="password" autocomplete="current-password" dir="ltr" [value]="current()" (input)="current.set($any($event.target).value)" />
        </div>
        <div>
          <label appLabel for="cp-new" required>{{ 'account.password.new' | t }}</label>
          <input appInput id="cp-new" type="password" autocomplete="new-password" dir="ltr" [value]="password()" (input)="password.set($any($event.target).value)" />
          <p class="mt-1 text-xs text-muted-foreground">{{ 'account.password.rules' | t }}</p>
        </div>
        <div>
          <label appLabel for="cp-confirm" required>{{ 'account.password.confirm' | t }}</label>
          <input appInput id="cp-confirm" type="password" autocomplete="new-password" dir="ltr" [value]="confirm()" (input)="confirm.set($any($event.target).value)" />
          @if (confirm() && confirm() !== password()) {
            <p class="mt-1 text-xs text-destructive">{{ 'server.validation.passwordMismatch' | t }}</p>
          }
        </div>
        <button type="submit" appButton class="self-start" [disabled]="actions.busy() || !current() || !password() || password() !== confirm()">{{ 'account.password.submit' | t }}</button>
      </div>
    </form>
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ChangePasswordPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly forced = computed(() => !!this.auth.user()?.mustChangePassword);
  protected readonly current = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');

  protected save(event: Event): void {
    event.preventDefault();
    void this.actions.run(this.api.changePassword({ currentPassword: this.current(), newPassword: this.password(), confirmPassword: this.confirm() }), null, async () => {
      // The API signs out every session (all devices) after a password change.
      this.auth.endSession();
      await this.router.navigate(['/', this.i18n.locale(), 'login'], { queryParams: { reason: 'password_changed' } });
    });
  }
}
