import { Component, computed, input } from '@angular/core';

import type { BarListItem } from './bar-list-item.interface';

/**
 * Horizontal bar chart rendered as an accessible list: every bar carries its
 * label and value as text, so the chart is never conveyed by colour or length
 * alone (accessibility §11 "charts accompanied by the underlying data").
 */
@Component({
  selector: 'app-bar-list',
  templateUrl: './bar-list.component.html',
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
