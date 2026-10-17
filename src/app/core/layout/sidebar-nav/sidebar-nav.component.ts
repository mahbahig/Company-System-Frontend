import { Component, booleanAttribute, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ChatStore } from '../../chat/chat-store.service';
import { NavigationService } from '../../navigation/navigation.service';

/**
 * Permission-filtered sidebar links (only pages the role can open; empty
 * groups are not rendered). The active link gets `aria-current="page"`;
 * nested routes (/customers/123) keep "Customers" active.
 *
 * Collapsed: icons only. The label stays in the link as screen-reader text
 * and appears, with a one-line description, in a tooltip on hover / focus;
 * group titles become thin dividers.
 */
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, TooltipDirective, TranslatePipe],
  templateUrl: './sidebar-nav.component.html',
})
export class SidebarNavComponent {
  protected readonly navigation = inject(NavigationService);
  private readonly i18n = inject(I18nService);
  /** The unread-messages badge (live: `ChatStore` follows the realtime events). */
  protected readonly chats = inject(ChatStore);

  /** Icon-only rail (desktop); the mobile drawer is always expanded. */
  readonly collapsed = input(false, { transform: booleanAttribute });

  /** Fired after a link is followed, so the mobile drawer can close. */
  readonly navigate = output();

  /** One-line purpose of a page, shown under its name in the collapsed tooltip. */
  protected description(labelKey: string): string {
    const key = `navigation.descriptions.${labelKey}`;
    return this.i18n.has(key) ? this.i18n.t(key) : '';
  }
}
