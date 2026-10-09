import { A11yModule } from '@angular/cdk/a11y';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Menu, X } from 'lucide';

import { environment } from '../../../../environments/environment';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { LocaleSwitcherComponent } from '../locale-switcher/locale-switcher.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { SidebarBrandComponent } from '../sidebar-brand/sidebar-brand.component';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/**
 * Authenticated layout: sidebar (drawer on mobile) + sticky top bar + content.
 * Same structure and classes as the Next app's AppShell. Logical properties
 * (start/end, ps/pe) make the same markup mirror for Arabic.
 */
@Component({
  selector: 'app-shell',
  imports: [
    A11yModule,
    RouterOutlet,
    ButtonDirective,
    IconComponent,
    TranslatePipe,
    SidebarBrandComponent,
    SidebarNavComponent,
    ThemeToggleComponent,
    GlobalSearchComponent,
    LocaleSwitcherComponent,
    NotificationBellComponent,
    UserMenuComponent,
  ],
  templateUrl: './app-shell.component.html',
  host: {
    // h-dvh + overflow-hidden pins the shell to the viewport so the sidebar
    // nav and the main content each scroll within their own pane instead of
    // the whole page scrolling as one.
    class: 'flex h-dvh overflow-hidden',
    '(document:keydown.escape)': 'closeDrawer()',
  },
})
export class AppShellComponent {
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly menuIcon = Menu;
  protected readonly closeIcon = X;
  protected readonly environmentBadge = environment.environmentBadge;
  protected readonly drawerOpen = signal(false);

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  /** Closes the drawer and returns focus to the button that opened it. */
  protected closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.menuButton().nativeElement.focus();
  }
}
