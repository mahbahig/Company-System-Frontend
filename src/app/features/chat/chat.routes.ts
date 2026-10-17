import type { Routes } from '@angular/router';

/**
 * `/chat` and `/chat/:chatId` — in-app messages, open to every signed-in
 * employee (no permission: the API answers each person from their own
 * memberships, and 404 for any conversation they are not in).
 */
export const CHAT_ROUTES: Routes = [
  {
    path: '',
    title: 'chat.title',
    loadComponent: () => import('./chat.page').then((m) => m.ChatPage),
  },
  {
    path: ':chatId',
    title: 'chat.title',
    loadComponent: () => import('./chat.page').then((m) => m.ChatPage),
  },
];
