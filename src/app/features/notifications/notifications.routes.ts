import type { Routes } from '@angular/router';

/** `/:locale/notifications` — the full inbox behind the shell's notification bell. */
export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'notifications.title',
    loadComponent: () => import('./notifications-list.page').then((m) => m.NotificationsListPage),
  },
];
