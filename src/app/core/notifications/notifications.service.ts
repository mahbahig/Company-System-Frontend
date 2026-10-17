import { DestroyRef, Injector, Service, effect, inject, runInInjectionContext, signal, untracked } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { Page } from '../api/page.interface';
import type { NotificationListQuery } from './notification-list-query.interface';
import type { AppNotification } from './notification.interface';

/** The bell keeps this many of the latest notifications. */
const RECENT_LIMIT = 10;
/** The realtime event of a new in-app notification (its stored record, for this user only). */
export const NOTIFICATION_CREATED = 'NOTIFICATION_CREATED';

/**
 * Bell state (unread count, latest items) and the full notification-center
 * data access. Live: each new notification arrives over the realtime
 * connection (`listen()`); after a reconnect the bell reads the API again for
 * whatever came while it was offline — no polling.
 */
@Service()
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private listening = false;

  readonly unreadCount = signal(0);
  readonly recent = signal<AppNotification[]>([]);

  /** Starts receiving notifications live (once, for the whole session). */
  listen(): void {
    if (this.listening) return;
    this.listening = true;
    runInInjectionContext(this.injector, () => {
      const realtime = inject(RealtimeService);
      const subscription = realtime.on<AppNotification>(NOTIFICATION_CREATED).subscribe((notification) => this.receive(notification));
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
      // Every reconnection (not the first connection — the bell loads itself): catch up on what was missed.
      effect(() => {
        if (realtime.connections() > 1) untracked(() => void this.refresh().catch(() => undefined));
      });
    });
  }

  /** A notification that just arrived: on top of the bell, counted unread (each id once). */
  receive(notification: AppNotification): void {
    if (!notification?.id || this.recent().some((item) => item.id === notification.id)) return;
    this.recent.update((items) => [notification, ...items].slice(0, RECENT_LIMIT));
    if (!notification.readAt) this.unreadCount.update((count) => count + 1);
  }

  async refresh(): Promise<void> {
    const [count, recent] = await Promise.all([
      firstValueFrom(this.api.get<{ count: number }>('notifications/unread-count')),
      firstValueFrom(this.api.get<AppNotification[]>('notifications/recent')),
    ]);
    this.unreadCount.set(count.count);
    this.recent.set(recent);
  }

  /** "Mark all as read" (an explicit action — opening the bell no longer clears what still needs attention). */
  async markAllRead(): Promise<void> {
    if (!this.unreadCount()) return;
    const now = new Date().toISOString();
    this.unreadCount.set(0);
    this.recent.update((items) => items.map((item) => (item.readAt ? item : { ...item, readAt: now })));
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
