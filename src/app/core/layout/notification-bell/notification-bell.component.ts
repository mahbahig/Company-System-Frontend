import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArrowRight, Bell, CheckCheck } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../../shared/ui/tooltip/tooltip.directive';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { NavigationService } from '../../navigation/navigation.service';
import { notificationAction, notificationTarget, type NotificationTarget } from '../../notifications/notification-action';
import type { AppNotification } from '../../notifications/notification.interface';
import { NotificationsService } from '../../notifications/notifications.service';
import { END_ALIGNED_BELOW } from '../menu-positions';

/** Refresh the badge while the tab is visible (notifications are generated server-side, per recipient). */
const REFRESH_MS = 90_000;

/**
 * Bell with an unread badge. The panel lists the latest notifications, each
 * saying what needs attention and offering its next step ("Review",
 * "Open task", "Open") — but only when the route guard would let this user
 * open the target; otherwise the notification is shown without a link.
 * Opening one marks it read; "Mark all as read" is explicit.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, RouterLink, IconComponent, TooltipDirective, TranslatePipe],
  templateUrl: './notification-bell.component.html',
})
export class NotificationBellComponent {
  private readonly notifications = inject(NotificationsService);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly bell = Bell;
  protected readonly arrow = ArrowRight;
  protected readonly checkAll = CheckCheck;
  protected readonly positions = END_ALIGNED_BELOW;
  protected readonly unread = this.notifications.unreadCount;
  protected readonly items = this.notifications.recent;
  protected readonly entries = computed(() =>
    this.items().map((item) => ({
      item,
      action: notificationAction(item),
      target: notificationTarget(item.actionUrl, this.i18n.locale(), (path) => this.navigation.canOpen(path)),
    })),
  );
  protected readonly label = computed(() =>
    this.unread() > 0 ? this.i18n.t('notifications.bellLabelUnread', { count: this.unread() }) : this.i18n.t('notifications.bellLabel'),
  );

  constructor() {
    const refresh = () => void this.notifications.refresh().catch(() => undefined);
    refresh();
    const document = inject(DOCUMENT);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected onOpen(): void {
    void this.notifications.refresh().catch(() => undefined);
  }

  protected markAllRead(): void {
    void this.notifications.markAllRead();
  }

  /** Marks it read; follows its link only when this user can open the target. */
  protected open(item: AppNotification, target: NotificationTarget | null): void {
    if (!item.readAt) void this.notifications.markRead([item.id]);
    if (target && this.navigation.canOpen(target.path)) void this.router.navigate(target.commands, { queryParams: target.queryParams });
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path}`;
  }
}
