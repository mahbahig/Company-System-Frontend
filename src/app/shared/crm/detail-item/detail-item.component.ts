import { Component, input } from '@angular/core';

/**
 * One label/value pair inside a `<dl>`: `<div appDetailItem [label]="…">value</div>`.
 * An attribute component on a <div> because a <dl> may only contain
 * dt/dd or div groups (axe `definition-list`).
 */
@Component({
  selector: 'div[appDetailItem]',
  templateUrl: './detail-item.component.html',
})
export class DetailItemComponent {
  readonly label = input.required<string>();
}
