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
  template: `
    <app-page-header [heading]="'account.mfa.title' | t" [subtitle]="'account.mfa.subtitle' | t" class="!mb-0" />
    @if (mustEnroll()) {
      <app-alert variant="destructive">{{ 'account.mfa.required' | t }}</app-alert>
    }
    @if (actions.message(); as text) {
      <app-alert>{{ text }}</app-alert>
    }
    @if (actions.error(); as text) {
      <app-alert variant="destructive">{{ text }}</app-alert>
    }

    @if (recoveryCodes(); as codes) {
      <section appCard class="max-w-xl" aria-labelledby="mfa-codes">
        <div appCardHeader>
          <h2 appCardTitle id="mfa-codes">{{ 'account.mfa.recoveryTitle' | t }}</h2>
          <p appCardDescription>{{ 'account.mfa.recoveryHint' | t }}</p>
        </div>
        <div appCardContent>
          <ul class="grid grid-cols-2 gap-2 font-mono text-sm" dir="ltr">
            @for (code of codes; track code) {
              <li class="rounded bg-muted px-2 py-1">{{ code }}</li>
            }
          </ul>
        </div>
      </section>
    }

    <section appCard class="max-w-xl" aria-labelledby="mfa-state">
      <div appCardHeader>
        <h2 appCardTitle id="mfa-state">{{ (enabled() ? 'account.mfa.enabled' : 'account.mfa.disabled') | t }}</h2>
      </div>
      <div appCardContent class="flex flex-col gap-4">
        @if (!enabled()) {
          @if (setup(); as s) {
            <ol class="list-decimal space-y-2 ps-5 text-sm">
              <li>{{ 'account.mfa.step1' | t }}</li>
              <li>
                {{ 'account.mfa.step2' | t }}
                <code class="mt-1 block break-all rounded bg-muted px-2 py-1 font-mono text-xs" dir="ltr">{{ s.secret }}</code>
                <a class="mt-1 inline-block text-xs text-primary hover:underline" [href]="s.otpauthUrl">{{ 'account.mfa.openApp' | t }}</a>
              </li>
              <li>{{ 'account.mfa.step3' | t }}</li>
            </ol>
            <div>
              <label appLabel for="mfa-enable-code" required>{{ 'account.mfa.code' | t }}</label>
              <input appInput id="mfa-enable-code" inputmode="numeric" autocomplete="one-time-code" dir="ltr" class="max-w-48 tabular tracking-widest" [value]="code()" (input)="code.set($any($event.target).value)" />
            </div>
            <button type="button" appButton class="self-start" [disabled]="actions.busy() || code().trim().length < 6" (click)="enable()">{{ 'account.mfa.enable' | t }}</button>
          } @else {
            <p class="text-sm text-muted-foreground">{{ 'account.mfa.intro' | t }}</p>
            <button type="button" appButton class="self-start" [disabled]="actions.busy()" (click)="start()">{{ 'account.mfa.setUp' | t }}</button>
          }
        } @else {
          <p class="text-sm text-muted-foreground">{{ 'account.mfa.disableHint' | t }}</p>
          <div>
            <label appLabel for="mfa-pw" required>{{ 'account.password.current' | t }}</label>
            <input appInput id="mfa-pw" type="password" autocomplete="current-password" dir="ltr" [value]="password()" (input)="password.set($any($event.target).value)" />
          </div>
          <div>
            <label appLabel for="mfa-disable-code" required>{{ 'account.mfa.code' | t }}</label>
            <input appInput id="mfa-disable-code" inputmode="numeric" autocomplete="one-time-code" dir="ltr" class="max-w-48 tabular tracking-widest" [value]="code()" (input)="code.set($any($event.target).value)" />
          </div>
          <button type="button" appButton variant="destructive" class="self-start" [disabled]="actions.busy() || !password() || code().trim().length < 6" (click)="disable()">{{ 'account.mfa.disable' | t }}</button>
        }
      </div>
    </section>
  `,
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
