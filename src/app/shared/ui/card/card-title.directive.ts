import { Directive } from '@angular/core';

/** Card title; put it on the heading element the page outline needs (h2, h3 …). */
@Directive({
  selector: '[appCardTitle]',
  host: { class: 'text-base font-semibold leading-snug tracking-tight text-foreground' },
})
export class CardTitleDirective {}
