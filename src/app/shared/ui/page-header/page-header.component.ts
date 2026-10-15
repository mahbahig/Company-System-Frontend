import { Component, input } from '@angular/core';

/**
 * Page title block used by every page: h1 + muted subtitle, with actions
 * (projected) on the end side.
 */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  host: { class: 'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between' },
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  /** Small line above the title, e.g. a record number. */
  readonly eyebrow = input<string>();
}
