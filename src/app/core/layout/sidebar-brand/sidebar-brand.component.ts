import { Component } from '@angular/core';
import { Sun } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Logo tile + product name at the top of the sidebar. */
@Component({
  selector: 'app-sidebar-brand',
  imports: [IconComponent, TranslatePipe],
  template: `
    <span aria-hidden="true" class="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground">
      <app-icon [icon]="sun" />
    </span>
    <span class="truncate text-sm font-semibold text-sidebar-foreground">{{ 'app.name' | t }}</span>
  `,
  host: { class: 'flex items-center gap-2.5 px-3 py-4' },
})
export class SidebarBrandComponent {
  protected readonly sun = Sun;
}
