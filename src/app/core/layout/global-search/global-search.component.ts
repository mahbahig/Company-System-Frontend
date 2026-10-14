import { Component, inject } from '@angular/core';
import { Search } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { CommandPalette } from '../../command-palette/command-palette.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { KeyboardShortcuts } from '../../shortcuts/keyboard-shortcuts.service';

/**
 * Top-bar entry to global search: a search-field-shaped button that opens
 * the command palette, where results appear as you type (grouped by record
 * type, inside your access) next to pages and commands. Ctrl/⌘+K or `/`
 * open it from anywhere; the full results page stays at `/search`.
 */
@Component({
  selector: 'app-global-search',
  imports: [TranslatePipe, IconComponent, TooltipDirective],
  template: `
    <button
      type="button"
      class="group hidden h-9 w-64 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground shadow-xs transition-[border-color,box-shadow,color] duration-200 ease-premium hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex lg:w-80"
      aria-haspopup="dialog"
      [attr.aria-keyshortcuts]="shortcuts.isMac ? 'Meta+K' : 'Control+K'"
      (click)="palette.show()"
    >
      <app-icon [icon]="searchIcon" />
      <span class="flex-1 truncate text-start">{{ 'ux.palette.trigger' | t }}</span>
      <kbd class="pointer-events-none hidden h-5 items-center rounded border border-border px-1.5 text-2xs text-muted-foreground lg:flex" dir="ltr">{{ shortcuts.isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>
    <button
      type="button"
      class="inline-flex size-9 items-center justify-center rounded-md hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      aria-haspopup="dialog"
      [attr.aria-label]="'ux.palette.trigger' | t"
      [appTooltip]="'ux.palette.trigger' | t"
      appTooltipSide="bottom"
      (click)="palette.show()"
    >
      <app-icon [icon]="searchIcon" />
    </button>
  `,
  host: { class: 'contents' },
})
export class GlobalSearchComponent {
  protected readonly palette = inject(CommandPalette);
  protected readonly shortcuts = inject(KeyboardShortcuts);
  protected readonly searchIcon = Search;
}
