import { Service, inject, signal } from '@angular/core';

import { LocalStore } from '../storage/local-store.service';

const KEY = 'ecotech.sidebar.collapsed';

/**
 * Desktop sidebar width (expanded with labels, or collapsed to icons with
 * tooltips). A per-browser display preference, so it lives in local storage
 * and survives reloads; the mobile drawer always opens expanded.
 */
@Service()
export class SidebarState {
  private readonly store = inject(LocalStore);

  readonly collapsed = signal(this.store.get(KEY) === '1');

  toggle(): void {
    this.set(!this.collapsed());
  }

  set(collapsed: boolean): void {
    this.collapsed.set(collapsed);
    this.store.set(KEY, collapsed ? '1' : '0');
  }
}
