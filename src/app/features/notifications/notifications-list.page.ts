import { Component, computed, inject, input, linkedSignal, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Check, CheckCheck } from 'lucide';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { NavigationService } from '../../core/navigation/navigation.service';
import { notificationAction, notificationTarget } from '../../core/notifications/notification-action';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ListSkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../shared/crm/pagination/page-size';

const flag = (value: string | undefined) => value === '1';

/**
 * `/notifications` — the full inbox behind the shell's notification bell:
 * paginated, filterable (unread only), mark-read / mark-all-read, deep
 * links into the referenced record. Shares `NotificationsService` with the
 * bell so both stay in sync (marking read here updates the bell's badge).
 *
 * No free-text search: the backend inbox endpoint does not filter on `q`
 * (see `NotificationsRepository.inbox`), so a search box here would be a
 * control that silently does nothing — omitted rather than faked.
 */
@Component({
  selector: 'app-notifications-list-page',
  imports: [TooltipDirective, ListSkeletonComponent, RouterLink, FormField, TranslatePipe, PageHeaderComponent, PaginationComponent, AlertComponent, BadgeComponent, ButtonDirective, IconComponent],
  templateUrl: './notifications-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class NotificationsListPage {
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);
  protected readonly i18n = inject(I18nService);

  readonly unread = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly checkIcon = Check;
  protected readonly checkAllIcon = CheckCheck;
  protected readonly unreadOnly = computed(() => flag(this.unread()));
  protected readonly hasUnread = computed(() => this.notifications.unreadCount() > 0);

  protected readonly result = rxResource({
    params: () => ({ unread: this.unreadOnly() || undefined, page: this.page(), pageSize: 25 }),
    stream: ({ params }) => this.notifications.list(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  /** Each row with its next step — a link only when the route guard would let this user open it. */
  protected readonly entries = computed(() =>
    this.rows().map((row) => ({
      row,
      action: notificationAction(row),
      target: notificationTarget(row.actionUrl, this.i18n.locale(), (path) => this.navigation.canOpen(path)),
    })),
  );

  protected readonly toggleModel = linkedSignal(() => ({ unreadOnly: this.unreadOnly() }));
  protected readonly toggleForm = form(this.toggleModel);

  protected onToggleUnreadOnly(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { unread: this.toggleModel().unreadOnly ? '1' : null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected async markAllRead(): Promise<void> {
    await this.notifications.markAllRead();
    this.result.reload();
  }

  protected async markRead(id: string, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.notifications.markRead([id]);
    this.result.reload();
  }

  /** Opening a notification marks it read without blocking navigation. */
  protected onOpen(id: string, readAt: string | null): void {
    if (readAt) return;
    void this.notifications.markRead([id]).then(() => this.result.reload());
  }

}
