import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaveShortcutDirective } from '../../../core/shortcuts/save-shortcut.directive';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CARD_IMPORTS } from '../../../shared/ui/card/card.imports';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { AccountApi } from '../account-api.service';

type PasswordField = 'current' | 'password' | 'confirm';

/**
 * AUTH-02 change password (the current password is re-verified). Also the
 * forced first-login step when `mustChangePassword` is set.
 *
 * A centred, focused composition: what the page does, the three fields with
 * show / hide, the policy shown as a live checklist (the same rule the API
 * applies: 12+ characters with a letter and a digit), and what happens next
 * (every session is signed out).
 */
@Component({
  selector: 'app-change-password-page',
  imports: [TranslatePipe, SaveShortcutDirective, AlertComponent, ButtonDirective, IconComponent, ...CARD_IMPORTS, ...FORM_IMPORTS],
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col gap-6 py-4 sm:py-10 animate-rise-in [animation-duration:420ms]">
      <header class="flex flex-col items-center gap-3 text-center">
        <span class="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden="true">
          <app-icon [icon]="keyIcon" svgClass="size-6" />
        </span>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-balance">{{ 'account.password.title' | t }}</h1>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ 'account.password.subtitle' | t }}</p>
        </div>
      </header>

      @if (forced()) {
        <app-alert variant="info">{{ 'account.password.forced' | t }}</app-alert>
      }

      <form appCard class="shadow-md" appSaveShortcut novalidate (submit)="save($event)">
        <div appCardContent class="flex flex-col gap-5">
          @if (actions.error(); as text) {
            <app-alert variant="destructive">{{ text }}</app-alert>
          }

          @for (field of fields; track field.key) {
            <div>
              <label appLabel [for]="'cp-' + field.key" required>{{ field.label | t }}</label>
              <div class="relative">
                <input
                  appInput
                  class="h-11 pe-11"
                  [id]="'cp-' + field.key"
                  [type]="visible()[field.key] ? 'text' : 'password'"
                  [attr.autocomplete]="field.key === 'current' ? 'current-password' : 'new-password'"
                  dir="ltr"
                  [value]="value(field.key)"
                  (input)="setValue(field.key, $any($event.target).value)"
                  [attr.aria-invalid]="field.key === 'confirm' && mismatch() ? true : null"
                  [attr.aria-describedby]="field.key === 'password' ? 'cp-rules' : field.key === 'confirm' && mismatch() ? 'cp-mismatch' : null"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [attr.aria-label]="(visible()[field.key] ? 'ux.password.hide' : 'ux.password.show') | t"
                  [attr.aria-pressed]="visible()[field.key]"
                  (click)="toggle(field.key)"
                >
                  <app-icon [icon]="visible()[field.key] ? hideIcon : showIcon" />
                </button>
              </div>
              @if (field.key === 'confirm' && mismatch()) {
                <p id="cp-mismatch" class="mt-1.5 text-xs text-destructive">{{ 'account.password.mismatch' | t }}</p>
              }
            </div>
          }

          <div id="cp-rules" class="rounded-lg border border-border/70 bg-muted/40 p-4">
            <p class="mb-2.5 text-xs font-semibold text-foreground">{{ 'account.password.requirements' | t }}</p>
            <ul class="grid gap-2 text-sm">
              @for (rule of rules(); track rule.key) {
                <li class="flex items-center gap-2.5 transition-colors duration-200" [class.text-success-tint]="rule.met" [class.text-muted-foreground]="!rule.met">
                  <span
                    class="flex size-5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-200"
                    [class.border-success]="rule.met"
                    [class.bg-success]="rule.met"
                    [class.text-success-foreground]="rule.met"
                    [class.border-border]="!rule.met"
                    aria-hidden="true"
                  >
                    @if (rule.met) {
                      <app-icon [icon]="checkIcon" svgClass="size-3" />
                    }
                  </span>
                  <span>{{ rule.label | t }}</span>
                  <span class="sr-only">({{ (rule.met ? 'account.password.ruleMet' : 'account.password.ruleUnmet') | t }})</span>
                </li>
              }
            </ul>
          </div>

          <button type="submit" appButton fullWidth size="lg" [disabled]="actions.busy() || !ready()" aria-keyshortcuts="Control+S Meta+S">
            {{ (actions.busy() ? 'crm.common.saving' : 'account.password.submit') | t }}
          </button>
        </div>
        <div appCardFooter>
          <p class="flex w-full items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <app-icon [icon]="shieldIcon" svgClass="size-3.5 shrink-0" />
            <span>{{ 'ux.password.signOutNote' | t }}</span>
          </p>
        </div>
      </form>
    </div>
  `,
  host: { class: 'flex flex-col' },
})
export class ChangePasswordPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  protected readonly keyIcon = KeyRound;
  protected readonly shieldIcon = ShieldCheck;
  protected readonly checkIcon = Check;
  protected readonly showIcon = Eye;
  protected readonly hideIcon = EyeOff;
  protected readonly fields: ReadonlyArray<{ key: PasswordField; label: string }> = [
    { key: 'current', label: 'account.password.current' },
    { key: 'password', label: 'account.password.new' },
    { key: 'confirm', label: 'account.password.confirm' },
  ];

  protected readonly forced = computed(() => !!this.auth.user()?.mustChangePassword);
  protected readonly current = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly visible = signal<Record<PasswordField, boolean>>({ current: false, password: false, confirm: false });

  /** The API's policy (`passwordPolicyError`): 12+ characters, a letter and a digit; plus the confirmation. */
  protected readonly rules = computed(() => {
    const value = this.password();
    return [
      { key: 'length', label: 'account.password.ruleLength', met: value.length >= 12 },
      { key: 'letter', label: 'account.password.ruleLetter', met: /[A-Za-z؀-ۿ]/.test(value) },
      { key: 'number', label: 'account.password.ruleNumber', met: /[0-9]/.test(value) },
      { key: 'match', label: 'ux.password.ruleMatch', met: !!value && value === this.confirm() },
    ];
  });
  protected readonly mismatch = computed(() => !!this.confirm() && this.confirm() !== this.password());
  protected readonly ready = computed(() => !!this.current() && this.rules().every((rule) => rule.met));

  protected value(field: PasswordField): string {
    return field === 'current' ? this.current() : field === 'password' ? this.password() : this.confirm();
  }

  protected setValue(field: PasswordField, value: string): void {
    (field === 'current' ? this.current : field === 'password' ? this.password : this.confirm).set(value);
  }

  protected toggle(field: PasswordField): void {
    this.visible.update((state) => ({ ...state, [field]: !state[field] }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    if (!this.ready() || this.actions.busy()) return;
    void this.actions.run(this.api.changePassword({ currentPassword: this.current(), newPassword: this.password(), confirmPassword: this.confirm() }), null, async () => {
      // The API signs out every session (all devices) after a password change.
      this.auth.endSession();
      await this.router.navigate(['/', this.i18n.locale(), 'login'], { queryParams: { reason: 'password_changed' } });
    });
  }
}
