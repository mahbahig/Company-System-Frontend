import { Service, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import type { Page } from '../api/page.interface';
import type { NotificationListQuery } from './notification-list-query.interface';
import type { AppNotification } from './notification.interface';

/** Bell state (unread count, latest items) and the full notification-center data access. */
@Service()
export class NotificationsService {
  private readonly api = inject(ApiService);

  readonly unreadCount = signal(0);
  readonly recent = signal<AppNotification[]>([]);

  async refresh(): Promise<void> {
    const [count, recent] = await Promise.all([
      firstValueFrom(this.api.get<{ count: number }>('notifications/unread-count')),
      firstValueFrom(this.api.get<AppNotification[]>('notifications/recent')),
    ]);
    this.unreadCount.set(count.count);
    this.recent.set(recent);
  }

  /** Opening the bell marks everything read (same behaviour as the Next app). */
  async markAllRead(): Promise<void> {
    if (!this.unreadCount()) return;
    this.unreadCount.set(0);
    await firstValueFrom(this.api.post('notifications/read-all')).catch(() => undefined);
  }

  /** Paginated inbox for the `/notifications` center. */
  list(query: NotificationListQuery): Observable<Page<AppNotification>> {
    return this.api.get<Page<AppNotification>>('notifications', { ...query });
  }

  /** Marks specific notifications read (e.g. on row click / a "mark read" action) and resyncs the bell. */
  async markRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await firstValueFrom(this.api.post('notifications/read', { ids })).catch(() => undefined);
    await this.refresh();
  }
}
