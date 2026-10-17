import { A11yModule } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide';

import { ConfirmHostComponent } from '../../../shared/ui/confirm/confirm-host.component';
import { ContextMenuHostComponent } from '../../../shared/ui/context-menu/context-menu-host.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { AuthService } from '../../auth/auth.service';
import { CommandPaletteComponent } from '../../command-palette/command-palette.component';
import { CommandPalette } from '../../command-palette/command-palette.service';
import { NAV_SHORTCUT_KEYS } from '../../command-palette/palette-commands.service';
import { I18nService } from '../../i18n/i18n.service';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { NavigationService } from '../../navigation/navigation.service';
import { KeyboardShortcuts, type Shortcut } from '../../shortcuts/keyboard-shortcuts.service';
import { ShortcutsHelpComponent } from '../../shortcuts/shortcuts-help.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { LocaleSwitcherComponent } from '../locale-switcher/locale-switcher.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { SidebarBrandComponent } from '../sidebar-brand/sidebar-brand.component';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { SidebarState } from '../sidebar-state.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/**
 * Authenticated layout: collapsible sidebar (drawer on mobile) + sticky top
 * bar + content, plus the app-wide overlays (command palette, shortcuts
 * help, confirmations). Logical properties (start/end, ps/pe) make the same
 * markup mirror for Arabic.
 *
 * Shell shortcuts: Ctrl/⌘+K and `/` (palette), `?` (help), `[` (sidebar) and
 * `g <letter>` jumps — registered only for pages this role can open, and
 * re-registered whenever the permissions change.
 */
@Component({
  selector: 'app-shell',
  imports: [
    A11yModule,
    RouterOutlet,
    ButtonDirective,
    IconComponent,
    TooltipDirective,
    TranslatePipe,
    SidebarBrandComponent,
    SidebarNavComponent,
    ThemeToggleComponent,
    GlobalSearchComponent,
    LocaleSwitcherComponent,
    NotificationBellComponent,
    UserMenuComponent,
    CommandPaletteComponent,
    ShortcutsHelpComponent,
    ConfirmHostComponent,
    ContextMenuHostComponent,
  ],
  templateUrl: './app-shell.component.html',
  host: {
    // h-dvh + overflow-hidden pins the shell to the viewport so the sidebar
    // nav and the main content each scroll within their own pane instead of
    // the whole page scrolling as one. `relative` makes the shell the
    // containing block of anything absolutely positioned outside <main>, so
    // nothing can extend the document past the viewport (no second scrollbar).
    class: 'relative flex h-dvh overflow-hidden',
    '(document:keydown.escape)': 'closeDrawer()',
  },
})
export class AppShellComponent {
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly navigation = inject(NavigationService);
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly palette = inject(CommandPalette);

  protected readonly auth = inject(AuthService);
  protected readonly maintenance = inject(MaintenanceService);
  protected readonly sidebar = inject(SidebarState);
  protected readonly menuIcon = Menu;
  protected readonly closeIcon = X;
  protected readonly collapseIcon = PanelLeftClose;
  protected readonly expandIcon = PanelLeftOpen;
  protected readonly drawerOpen = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const t = (key: string) => () => this.i18n.t(key);
    // A Super Administrator keeps working during maintenance: the banner reminds them everyone else cannot.
    if (this.auth.can('security.manage_settings')) void this.maintenance.refreshAdministratorNotice();
    const general: Shortcut[] = [
      { id: 'shell:palette', keys: 'mod+k', group: 'general', label: t('ux.shortcuts.palette'), allowInInput: true, allowInDialog: true, run: () => this.togglePalette() },
      { id: 'shell:search', keys: '/', group: 'general', label: t('ux.shortcuts.search'), run: () => this.palette.show() },
      { id: 'shell:help', keys: '?', group: 'general', label: t('ux.shortcuts.help'), run: () => this.shortcuts.helpOpen.set(true) },
      { id: 'shell:sidebar', keys: '[', group: 'general', label: t('ux.shortcuts.sidebar'), run: () => this.sidebar.toggle() },
    ];
    for (const shortcut of general) destroyRef.onDestroy(this.shortcuts.register(shortcut));

    // `g <letter>` only for pages in this role's (permission-filtered) navigation.
    effect((onCleanup) => {
      const items = this.navigation.sections().flatMap((section) => section.items);
      const targets = [
        ...items
          .filter((item) => NAV_SHORTCUT_KEYS[item.labelKey])
          .map((item) => ({ path: item.path, keys: NAV_SHORTCUT_KEYS[item.labelKey], labelKey: `navigation.items.${item.labelKey}` })),
        { path: '/notifications', keys: 'g n', labelKey: 'notifications.title' },
      ];
      const unregister = targets
        .filter((target) => this.navigation.canOpen(target.path))
        .map((target) =>
          this.shortcuts.register({
            id: `nav:${target.path}`,
            keys: target.keys,
            group: 'navigation',
            label: t(target.labelKey),
            run: () => void this.router.navigateByUrl(target.path),
          }),
        );
      onCleanup(() => unregister.forEach((remove) => remove()));
    });
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  /** Closes the drawer and returns focus to the button that opened it. */
  protected closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.menuButton().nativeElement.focus();
  }

  /** Ctrl/⌘+K toggles the palette, but never opens it over another dialog. */
  private togglePalette(): void {
    if (this.palette.open()) {
      this.palette.hide();
      return;
    }
    if (this.document.querySelector('dialog[open]')) return;
    this.palette.show();
  }
}
