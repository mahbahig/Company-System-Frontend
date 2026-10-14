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
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="panel"
      [cdkMenuPosition]="positions"
      (cdkMenuOpened)="onOpen()"
      [attr.aria-label]="label()"
      [appTooltip]="'notifications.title' | t"
      appTooltipSide="bottom"
      class="relative inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <app-icon [icon]="bell" />
      @if (unread() > 0) {
        <span
          aria-hidden="true"
          class="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold leading-none text-destructive-foreground animate-scale-in [animation-duration:200ms]"
        >
          {{ unread() > 99 ? '99+' : unread() }}
        </span>
      }
    </button>

    <ng-template #panel>
      <div cdkMenu class="z-50 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
        <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p class="text-sm font-semibold">{{ 'notifications.title' | t }}</p>
          @if (unread() > 0) {
            <button
              type="button"
              cdkMenuItem
              (cdkMenuItemTriggered)="markAllRead()"
              class="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-secondary focus:bg-secondary"
            >
              <app-icon [icon]="checkAll" svgClass="size-3.5" />
              {{ 'notifications.markAllRead' | t }}
            </button>
          }
        </div>
        @if (items().length === 0) {
          <p class="px-3 py-6 text-center text-sm text-muted-foreground">{{ 'notifications.empty' | t }}</p>
        } @else {
          <ul class="max-h-96 overflow-y-auto scroll-area">
            @for (entry of entries(); track entry.item.id) {
              <li>
                <button
                  type="button"
                  cdkMenuItem
                  (cdkMenuItemTriggered)="open(entry.item, entry.target)"
                  class="block w-full text-start outline-none hover:bg-secondary focus:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span class="flex flex-col gap-1 border-b border-border px-3 py-2.5" [class.bg-primary/5]="!entry.item.readAt">
                    <span class="flex items-start gap-1.5 text-sm leading-snug" [class.font-semibold]="!entry.item.readAt" [class.font-medium]="entry.item.readAt">
                      @if (!entry.item.readAt) {
                        <span aria-hidden="true" class="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary"></span>
                        <span class="sr-only">{{ 'ux.notifications.unread' | t }}</span>
                      }
                      <span>{{ i18n.pick(entry.item.titleAr, entry.item.titleEn) }}</span>
                    </span>
                    @if (i18n.pick(entry.item.bodyAr, entry.item.bodyEn); as body) {
                      <span class="line-clamp-2 text-xs text-muted-foreground">{{ body }}</span>
                    }
                    <span class="flex items-center justify-between gap-2">
                      <span class="text-2xs text-muted-foreground">{{ i18n.formatRelative(entry.item.createdAt) }}</span>
                      @if (entry.target) {
                        <span class="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          {{ 'ux.notifications.actions.' + entry.action | t }}
                          <app-icon [icon]="arrow" svgClass="size-3 rtl:-scale-x-100" />
                        </span>
                      }
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
        <a
          cdkMenuItem
          [routerLink]="link('/notifications')"
          class="block border-t border-border px-3 py-2.5 text-center text-sm font-medium text-primary outline-none hover:bg-secondary focus:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {{ 'notifications.viewAll' | t }}
        </a>
      </div>
    </ng-template>
  `,
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
