import type { Routes } from '@angular/router';

/** `/:locale/account/...` self-service for every signed-in user (profile & sessions, AUTH-02, AUTH-03, AUTH-06, NOTIF-01). */
export const ACCOUNT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'profile' },
  { path: 'profile', title: 'account.profile.title', loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage) },
  { path: 'password', title: 'account.password.title', loadComponent: () => import('./password/change-password.page').then((m) => m.ChangePasswordPage) },
  { path: 'security', title: 'account.mfa.title', loadComponent: () => import('./security/security.page').then((m) => m.SecurityPage) },
  { path: 'notifications', title: 'account.notifications.title', loadComponent: () => import('./notifications/notification-preferences.page').then((m) => m.NotificationPreferencesPage) },
];
