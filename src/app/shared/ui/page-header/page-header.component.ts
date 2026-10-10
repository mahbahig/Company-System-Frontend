import { Component, input } from '@angular/core';

/**
 * Page title block used by every page: h1 + muted subtitle, with actions
 * (projected) on the end side.
 */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="min-w-0">
      @if (eyebrow()) {
        <p class="tabular text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground" dir="ltr">{{ eyebrow() }}</p>
      }
      <h1 class="mt-0.5 text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-[1.7rem]">{{ heading() }}</h1>
      @if (subtitle()) {
        <p class="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex flex-wrap items-center gap-2"><ng-content /></div>
  `,
  host: { class: 'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between' },
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>();
  /** Small line above the title, e.g. a record number. */
  readonly eyebrow = input<string>();
}
