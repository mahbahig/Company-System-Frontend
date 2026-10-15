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
  templateUrl: './otp-input.component.html',
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
