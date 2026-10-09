import { Component, input } from '@angular/core';

/**
 * One label/value pair inside a `<dl>`: `<div appDetailItem [label]="…">value</div>`.
 * An attribute component on a <div> because a <dl> may only contain
 * dt/dd or div groups (axe `definition-list`).
 */
@Component({
  selector: 'div[appDetailItem]',
  template: `
    <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ label() }}</dt>
    <dd class="mt-1 text-sm"><ng-content /></dd>
  `,
})
export class DetailItemComponent {
  readonly label = input.required<string>();
}
