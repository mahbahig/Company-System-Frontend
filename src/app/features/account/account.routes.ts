import type { Routes } from '@angular/router';

/** `/:locale/account/...` self-service (AUTH-02, AUTH-06, NOTIF-01). */
export const ACCOUNT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'password' },
  { path: 'password', title: 'account.password.title', loadComponent: () => import('./password/change-password.page').then((m) => m.ChangePasswordPage) },
  { path: 'security', title: 'account.mfa.title', loadComponent: () => import('./security/security.page').then((m) => m.SecurityPage) },
  { path: 'notifications', title: 'account.notifications.title', loadComponent: () => import('./notifications/notification-preferences.page').then((m) => m.NotificationPreferencesPage) },
];
