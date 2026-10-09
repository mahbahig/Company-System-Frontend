import { Component, computed, input } from '@angular/core';

import type { BarListItem } from './bar-list-item.interface';

/**
 * Horizontal bar chart rendered as an accessible list: every bar carries its
 * label and value as text, so the chart is never conveyed by colour or length
 * alone (accessibility §11 "charts accompanied by the underlying data").
 */
@Component({
  selector: 'app-bar-list',
  template: `
    @if (items().length) {
      <ul class="flex flex-col gap-3" [attr.aria-label]="label()">
        @for (item of items(); track item.label) {
          <li class="flex flex-col gap-1">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="truncate">{{ item.label }}@if (item.note) {<span class="ms-2 text-xs text-muted-foreground">{{ item.note }}</span>}</span>
              <span class="tabular shrink-0 font-medium" dir="ltr">{{ item.display ?? item.value }}</span>
            </div>
            <div class="h-2 rounded-full bg-muted" aria-hidden="true">
              <div class="h-2 rounded-full bg-primary" [style.width.%]="width(item.value)"></div>
            </div>
          </li>
        }
      </ul>
    } @else {
      <p class="py-6 text-center text-sm text-muted-foreground">{{ emptyText() }}</p>
    }
  `,
  host: { class: 'block' },
})
export class BarListComponent {
  readonly items = input.required<BarListItem[]>();
  readonly label = input<string>();
  readonly emptyText = input('—');

  private readonly max = computed(() => Math.max(0, ...this.items().map((item) => item.value)));

  protected width(value: number): number {
    const max = this.max();
    return max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  }
}
