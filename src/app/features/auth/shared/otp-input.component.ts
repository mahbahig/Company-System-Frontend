import { Component, computed, input, model, signal } from '@angular/core';

/** Arabic-Indic (٠–٩) and Extended Arabic-Indic (۰–۹) digits, as typed on Arabic keyboards. */
const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

function toAsciiDigits(text: string): string {
  return text.replace(ARABIC_DIGITS, (digit) =>
    String(digit.charCodeAt(0) - (digit >= '\u06F0' ? 0x06f0 : 0x0660)),
  );
}

/**
 * One-time-code entry drawn as separate digit cells. Underneath it is a single
 * real `<input>` stretched transparently over the cells, so screen readers meet
 * one labelled field, and paste, `autocomplete="one-time-code"` fills and
 * mobile code suggestions all work natively. Arabic-Indic digits are accepted
 * and stored as ASCII; anything else is dropped on entry. The caret always
 * sits after the last digit, where the next one goes. Digits read
 * left-to-right in both languages.
 */
@Component({
  selector: 'app-otp-input',
  template: `
    <div class="relative" dir="ltr" [attr.data-invalid]="invalid()">
      <input
        #field
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        spellcheck="false"
        [id]="inputId()"
        [value]="value()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        class="absolute inset-0 z-10 size-full cursor-text appearance-none border-0 bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        (input)="onInput(field)"
        (focus)="focused.set(true); toEnd(field)"
        (click)="toEnd(field)"
        (keyup)="toEnd(field)"
        (blur)="focused.set(false)"
      />
      <div aria-hidden="true" class="flex items-center gap-2 sm:gap-2.5">
        @for (digit of cells(); track $index) {
          @if ($index === splitAt()) {
            <span class="h-px w-2.5 shrink-0 rounded-full bg-border sm:w-3.5"></span>
          }
          <div
            class="relative flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-input bg-card text-[1.375rem] font-semibold text-foreground tabular shadow-xs transition-[border-color,box-shadow] duration-200 ease-premium data-[filled=true]:border-foreground/30 data-[active=true]:border-primary data-[active=true]:ring-4 data-[active=true]:ring-primary/15 [[data-invalid=true]_&]:border-destructive"
            [attr.data-filled]="digit !== ''"
            [attr.data-active]="focused() && $index === activeIndex()"
          >
            {{ digit }}
            @if (focused() && $index === activeIndex() && digit === '') {
              <span class="h-6 w-px bg-foreground animate-caret-blink"></span>
            }
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class OtpInputComponent {
  readonly value = model('');
  readonly inputId = input.required<string>();
  readonly length = input(6);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected readonly focused = signal(false);
  protected readonly cells = computed(() =>
    Array.from({ length: this.length() }, (_, index) => this.value()[index] ?? ''),
  );
  /** The cell the next digit lands in (the last one once the code is complete). */
  protected readonly activeIndex = computed(() => Math.min(this.value().length, this.length() - 1));
  /** Codes are easier to read back in two halves (123 456). */
  protected readonly splitAt = computed(() => (this.length() % 2 === 0 ? this.length() / 2 : -1));

  protected onInput(field: HTMLInputElement): void {
    const digits = toAsciiDigits(field.value).replace(/\D/g, '').slice(0, this.length());
    if (field.value !== digits) field.value = digits;
    this.value.set(digits);
  }

  protected toEnd(field: HTMLInputElement): void {
    const end = field.value.length;
    field.setSelectionRange(end, end);
  }
}
