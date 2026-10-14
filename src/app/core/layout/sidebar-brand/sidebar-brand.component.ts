import { Component, booleanAttribute, input } from '@angular/core';

import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Logo + product name at the top of the sidebar (the logo alone when collapsed).
 * The logo is the ECOTECH sun from ecotecheg.com (the same image as the tab
 * icon), turning slowly in 2D.
 */
@Component({
  selector: 'app-sidebar-brand',
  imports: [TranslatePipe],
  template: `
    <img
      src="brand/ecotech-sun.png"
      alt=""
      width="36"
      height="36"
      draggable="false"
      decoding="async"
      class="size-9 shrink-0 select-none animate-brand-spin"
    />
    <span class="truncate text-sm font-semibold tracking-tight text-sidebar-foreground" [class.sr-only]="collapsed()">{{
      'app.name' | t
    }}</span>
  `,
  host: {
    class: 'flex items-center gap-3 py-4 transition-[padding] duration-200 ease-premium',
    '[class.px-3]': '!collapsed()',
    '[class.justify-center]': 'collapsed()',
  },
})
export class SidebarBrandComponent {
  readonly collapsed = input(false, { transform: booleanAttribute });
}
