import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Check, KeyRound, LockKeyhole, ShieldCheck } from 'lucide';

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
import { PasswordToggleComponent } from '../shared/password-toggle.component';

/**
 * The API's password policy (AUTH-02): at least 12 characters with a letter
 * (Latin or Arabic) and a digit. Mirrored here only to guide the user as they
 * type — the server stays the authority and its errors are shown as-is.
 */
const PASSWORD_MIN_LENGTH = 12;
const LETTER = /[A-Za-z\u0600-\u06FF]/;
const DIGIT = /[0-9]/;

/** AUTH-02 reset from the e-mailed link (`?token=`); the link is single-use and expires. */
@Component({
  selector: 'app-reset-password-page',
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
    PasswordToggleComponent,
  ],
  template: `
    <app-auth-heading
      [icon]="recoveryIcon"
      eyebrow="account.forgot.eyebrow"
      title="account.reset.title"
      [lead]="done() ? null : 'account.reset.subtitle'"
    />

    @if (done()) {
      <app-auth-result class="mt-10" [icon]="doneIcon" message="account.reset.done">
        <a appAuthButton [routerLink]="['/', i18n.locale(), 'login']">{{
          'account.backToLogin' | t
        }}</a>
      </app-auth-result>
    } @else if (!token()) {
      <div class="mt-8 space-y-6">
        <app-auth-notice variant="destructive" class="animate-fade-in">{{
          'account.reset.invalidLink' | t
        }}</app-auth-notice>
        <a appAuthButton [routerLink]="['/', i18n.locale(), 'forgot-password']">{{
          'account.reset.requestNew' | t
        }}</a>
      </div>
    } @else {
      <form class="mt-8 space-y-5" (submit)="save($event)">
        @if (actions.error(); as text) {
          <app-auth-notice variant="destructive" class="animate-shake">{{ text }}</app-auth-notice>
        }

        <div class="animate-fade-in-up [animation-delay:80ms]">
          <app-auth-field fieldId="rp-new" label="account.password.new" [icon]="lockIcon" required>
            <input
              #newPassword
              appAuthInput
              id="rp-new"
              [type]="showNew() ? 'text' : 'password'"
              autocomplete="new-password"
              dir="ltr"
              class="pe-12 ps-11"
              aria-describedby="rp-new-rules"
              [value]="password()"
              (input)="password.set(newPassword.value)"
            />
            <app-password-toggle controls="rp-new" [(shown)]="showNew" />
          </app-auth-field>
          <ul
            id="rp-new-rules"
            class="mt-3 grid gap-1.5 text-[0.8125rem]"
            [attr.aria-label]="'account.password.requirements' | t"
          >
            @for (rule of rules(); track rule.key) {
              <li
                class="flex items-center gap-2 transition-colors duration-200"
                [class.text-success-tint]="rule.met"
                [class.text-muted-foreground]="!rule.met"
              >
                <span
                  aria-hidden="true"
                  class="flex size-4 shrink-0 items-center justify-center rounded-full border border-input transition-colors duration-200 data-[met=true]:border-success data-[met=true]:bg-success data-[met=true]:text-success-foreground"
                  [attr.data-met]="rule.met"
                >
                  @if (rule.met) {
                    <app-icon [icon]="checkIcon" svgClass="size-2.5 animate-scale-in" />
                  }
                </span>
                {{ rule.key | t }}
                <span class="sr-only"
                  >({{
                    (rule.met ? 'account.password.ruleMet' : 'account.password.ruleUnmet') | t
                  }})</span
                >
              </li>
            }
          </ul>
        </div>

        <app-auth-field
          class="animate-fade-in-up [animation-delay:130ms]"
          fieldId="rp-confirm"
          label="account.password.confirm"
          [icon]="lockIcon"
          [error]="mismatch() ? 'account.password.mismatch' : null"
          required
        >
          <input
            #confirmPassword
            appAuthInput
            id="rp-confirm"
            [type]="showConfirm() ? 'text' : 'password'"
            autocomplete="new-password"
            dir="ltr"
            class="pe-12 ps-11"
            [value]="confirm()"
            (input)="confirm.set(confirmPassword.value)"
            [attr.aria-invalid]="mismatch() ? true : null"
            [attr.aria-describedby]="mismatch() ? 'rp-confirm-error' : null"
          />
          <app-password-toggle controls="rp-confirm" [(shown)]="showConfirm" />
        </app-auth-field>

        <div class="pt-1 animate-fade-in-up [animation-delay:180ms]">
          <button
            type="submit"
            appAuthButton
            [busy]="actions.busy()"
            busyLabel="account.reset.submit"
            [disabled]="actions.busy() || !password() || password() !== confirm()"
          >
            {{ 'account.reset.submit' | t }}
          </button>
        </div>
      </form>
    }

    @if (!done()) {
      <div class="mt-8 flex justify-center animate-fade-in [animation-delay:240ms]">
        <a appAuthLink tone="muted" [routerLink]="['/', i18n.locale(), 'login']">
          <app-icon [icon]="backIcon" svgClass="size-4 rtl:-scale-x-100" />{{
            'account.backToLogin' | t
          }}
        </a>
      </div>
    }
  `,
  host: { class: 'block' },
})
export class ResetPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly token = input<string>();
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly done = signal(false);
  protected readonly showNew = signal(false);
  protected readonly showConfirm = signal(false);

  protected readonly recoveryIcon = KeyRound;
  protected readonly lockIcon = LockKeyhole;
  protected readonly checkIcon = Check;
  protected readonly backIcon = ArrowLeft;
  protected readonly doneIcon = ShieldCheck;

  /** Inline hint once the user has typed a confirmation that doesn't match. */
  protected readonly mismatch = computed(
    () => this.confirm().length > 0 && this.password() !== this.confirm(),
  );

  /** Live checklist of the password policy, ticked off as the user types. */
  protected readonly rules = computed(() => {
    const password = this.password();
    return [
      { key: 'account.password.ruleLength', met: password.length >= PASSWORD_MIN_LENGTH },
      { key: 'account.password.ruleLetter', met: LETTER.test(password) },
      { key: 'account.password.ruleNumber', met: DIGIT.test(password) },
    ];
  });

  protected save(event: Event): void {
    event.preventDefault();
    void this.actions.run(
      this.api.resetPassword({
        token: this.token() ?? '',
        newPassword: this.password(),
        confirmPassword: this.confirm(),
      }),
      null,
      () => this.done.set(true),
    );
  }
}
