import { Component, input, model } from '@angular/core';

import type { TabItem } from './tab-item.interface';

/**
 * Accessible tab strip (WAI-ARIA tabs pattern, arrow keys move between tabs).
 * The panel content is rendered by the page with `@switch (active())`.
 *
 * Never shows a scrollbar: the baseline is an inset shadow the active tab's
 * underline covers (no tab hangs past the strip), and a strip too long for a
 * narrow screen still swipes sideways, with focus scrolling tabs into view.
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
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
