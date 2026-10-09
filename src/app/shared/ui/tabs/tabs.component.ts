import { Component, input, model } from '@angular/core';

import type { TabItem } from './tab-item.interface';

/**
 * Accessible tab strip (WAI-ARIA tabs pattern, arrow keys move between tabs).
 * The panel content is rendered by the page with `@switch (active())`.
 */
@Component({
  selector: 'app-tabs',
  template: `
    <div role="tablist" [attr.aria-label]="label()" class="flex gap-1 overflow-x-auto border-b border-border">
      @for (tab of tabs(); track tab.id; let index = $index) {
        <button
          type="button"
          role="tab"
          [id]="'tab-' + tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.tabindex]="active() === tab.id ? 0 : -1"
          (click)="active.set(tab.id)"
          (keydown)="onKey($event, index)"
          class="-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [class.border-primary]="active() === tab.id"
          [class.text-foreground]="active() === tab.id"
          [class.border-transparent]="active() !== tab.id"
          [class.text-muted-foreground]="active() !== tab.id"
        >
          {{ tab.label }}
          @if (tab.count !== undefined && tab.count !== null) {
            <span class="tabular rounded-full bg-muted px-2 py-0.5 text-xs">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly label = input<string>();
  readonly active = model.required<string>();

  protected onKey(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    const rtl = document.documentElement.dir === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    this.active.set(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }
}
