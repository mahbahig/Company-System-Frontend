import { Dir } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { MaintenanceScreenComponent } from './core/maintenance/maintenance-screen.component';
import { ChatStore } from './core/chat/chat-store.service';
import { MaintenanceService } from './core/maintenance/maintenance.service';
import { NotificationsService } from './core/notifications/notifications.service';
import { SecurityEvents } from './core/realtime/security-events.service';
import { ThemeService } from './core/theme/theme.service';
import { ToastHostComponent } from './shared/ui/toast/toast-host.component';

/**
 * Root: the skip link (first focusable element on every page) and the
 * router outlet, covered by the maintenance screen while the API answers
 * with maintenance, plus the toasts. `Dir` gives the CDK (menus, overlays)
 * the live text direction so drop-downs mirror correctly in Arabic. The
 * realtime connection (Socket.IO) runs from here for the whole session —
 * its security events (`SecurityEvents`) and live notifications.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dir, TranslatePipe, MaintenanceScreenComponent, ToastHostComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly maintenance = inject(MaintenanceService);
  private readonly document = inject(DOCUMENT);

  constructor() {
    inject(ThemeService); // applies the stored theme for the whole session
    inject(SecurityEvents); // opens the realtime connection while signed in; forced logout and the system lock
    inject(NotificationsService).listen(); // live notifications over the same connection
    inject(ChatStore).listen(); // unread messages (the navigation badge) over the same connection
  }

  /** In-page jump without touching the router URL. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.document.getElementById('main-content');
    main?.setAttribute('tabindex', '-1');
    main?.focus();
  }
}
