import { Component, input } from '@angular/core';

/**
 * One label/value pair inside a `<dl>`: `<div appDetailItem [label]="…">value</div>`.
 * An attribute component on a <div> because a <dl> may only contain
 * dt/dd or div groups (axe `definition-list`).
 */
@Component({
  selector: 'div[appDetailItem]',
  template: `
    <dt class="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{{ label() }}</dt>
    <dd class="mt-1.5 text-sm font-medium leading-relaxed text-foreground break-words"><ng-content /></dd>
  `,
})
export class DetailItemComponent {
  readonly label = input.required<string>();
}
