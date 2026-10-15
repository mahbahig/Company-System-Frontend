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
  templateUrl: './global-search.component.html',
  host: { class: 'contents' },
})
export class GlobalSearchComponent {
  protected readonly palette = inject(CommandPalette);
  protected readonly shortcuts = inject(KeyboardShortcuts);
  protected readonly searchIcon = Search;
}
