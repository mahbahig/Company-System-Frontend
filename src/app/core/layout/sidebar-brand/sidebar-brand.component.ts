import { Component } from '@angular/core';
import { Sun } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Logo tile + product name at the top of the sidebar. */
@Component({
  selector: 'app-sidebar-brand',
  imports: [IconComponent, TranslatePipe],
  template: `
    <span
      aria-hidden="true"
      class="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sidebar-accent to-primary text-primary-foreground shadow-md shadow-black/15 ring-1 dark:shadow-black/30 ring-sidebar-foreground/10"
    >
      <app-icon [icon]="sun" svgClass="size-5" />
      <!-- A single slow light-sweep gives the mark a crafted, metallic feel. -->
      <span
        class="pointer-events-none absolute inset-y-0 -start-full w-1/2 bg-white/25 blur-[2px] animate-sheen"
      ></span>
    </span>
    <span class="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{{
      'app.name' | t
    }}</span>
  `,
  host: { class: 'flex items-center gap-3 px-3 py-4' },
})
export class SidebarBrandComponent {
  protected readonly sun = Sun;
}
