import { Component, input } from '@angular/core';

/**
 * Horizontal scroll container for wide tables. It is a focusable, labelled
 * region so keyboard users can scroll it horizontally (WCAG 2.1.1 / axe
 * `scrollable-region-focusable`).
 * Its height always grows with its table, so the page (the shell's <main>)
 * is the only vertical scroller.
 */
@Component({
  selector: 'app-table-wrapper',
  templateUrl: './table-wrapper.component.html',
  host: {
    role: 'region',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    class:
      'block w-full overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class TableWrapperComponent {
  readonly label = input.required<string>();
}
