import { Component, input } from '@angular/core';

/**
 * Scroll container for wide tables. It is a focusable, labelled region so
 * keyboard users can scroll it horizontally (WCAG 2.1.1 / axe
 * `scrollable-region-focusable`).
 */
@Component({
  selector: 'app-table-wrapper',
  template: '<ng-content />',
  host: {
    role: 'region',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    class:
      'block w-full overflow-x-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class TableWrapperComponent {
  readonly label = input.required<string>();
}
