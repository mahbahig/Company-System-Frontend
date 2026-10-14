import { Directive } from '@angular/core';

/**
 * Card header: title (+ optional description / actions). Full top padding;
 * the content that follows continues without a second top gap. A header with
 * nothing below it closes the card with the full bottom padding.
 */
@Directive({
  selector: '[appCardHeader]',
  host: { 'data-slot': 'card-header', class: 'flex flex-col gap-1.5 px-6 pb-4 pt-6 last:pb-6 sm:px-7' },
})
export class CardHeaderDirective {}
