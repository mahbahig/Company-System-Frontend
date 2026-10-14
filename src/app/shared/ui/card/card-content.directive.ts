import { Directive } from '@angular/core';

/**
 * Card body. Full padding on every side — also when the card has no header,
 * which used to leave the content flush against the top edge — and no extra
 * top gap right after a header.
 */
@Directive({
  selector: '[appCardContent]',
  host: { 'data-slot': 'card-content', class: 'block px-6 pb-6 pt-6 sm:px-7 [[data-slot=card-header]+&]:pt-0' },
})
export class CardContentDirective {}
