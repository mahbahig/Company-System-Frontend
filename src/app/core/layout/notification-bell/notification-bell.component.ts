import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Bell } from 'lucide';

import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { NotificationsService } from '../../notifications/notifications.service';
import { END_ALIGNED_BELOW } from '../menu-positions';

/**
 * Bell with a destructive unread badge. Opening it lists the latest
 * notifications and marks them all read (same behaviour as the Next app).
 */
@Component({
  selector: 'app-notification-bell',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, RouterLink, IconComponent, TranslatePipe],
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="panel"
      [cdkMenuPosition]="positions"
      (cdkMenuOpened)="onOpen()"
      [attr.aria-label]="label()"
      class="relative inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <app-icon [icon]="bell" />
      @if (unread() > 0) {
        <span
          aria-hidden="true"
          class="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold leading-none text-destructive-foreground"
        >
          {{ unread() > 99 ? '99+' : unread() }}
        </span>
      }
    </button>

    <ng-template #panel>
      <div
        cdkMenu
        class="z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
      >
        <div class="border-b border-border px-3 py-2">
          <p class="text-sm font-semibold">{{ 'notifications.title' | t }}</p>
        </div>
        @if (items().length === 0) {
          <p class="px-3 py-6 text-center text-sm text-muted-foreground">{{ 'notifications.empty' | t }}</p>
        } @else {
          <ul class="max-h-96 overflow-y-auto">
            @for (item of items(); track item.id) {
              <li>
                <a
                  cdkMenuItem
                  [routerLink]="item.actionUrl ? link(item.actionUrl) : null"
                  class="block outline-none hover:bg-secondary focus:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    class="flex flex-col gap-0.5 border-b border-border px-3 py-2.5 text-start"
                    [class.bg-primary/5]="!item.readAt"
                  >
                    <span class="flex items-center gap-1.5 text-sm font-medium leading-snug">
                      @if (!item.readAt) {
                        <span aria-hidden="true" class="inline-block size-1.5 shrink-0 rounded-full bg-primary"></span>
                      }
                      {{ i18n.pick(item.titleAr, item.titleEn) }}
                    </span>
                    @if (i18n.pick(item.bodyAr, item.bodyEn); as body) {
                      <span class="line-clamp-2 text-xs text-muted-foreground">{{ body }}</span>
                    }
                    <span class="text-2xs text-muted-foreground">{{ i18n.formatDate(item.createdAt, true) }}</span>
                  </span>
                </a>
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
  protected readonly i18n = inject(I18nService);

  protected readonly bell = Bell;
  protected readonly positions = END_ALIGNED_BELOW;
  protected readonly unread = this.notifications.unreadCount;
  protected readonly items = this.notifications.recent;
  protected readonly label = computed(() =>
    this.unread() > 0 ? this.i18n.t('notifications.bellLabelUnread', { count: this.unread() }) : this.i18n.t('notifications.bellLabel'),
  );

  constructor() {
    void this.notifications.refresh().catch(() => undefined);
  }

  protected onOpen(): void {
    void this.notifications.markAllRead();
  }

  protected link(path: string): string {
    return `/${this.i18n.locale()}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
