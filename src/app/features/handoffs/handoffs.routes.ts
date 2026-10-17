import type { Routes } from '@angular/router';

/** `/handoffs` — PM / Technical Lead inbox (HAND-05). The package itself lives under the opportunity. */
export const HANDOFFS_ROUTES: Routes = [
  { path: '', title: 'handoffs.inboxTitle', loadComponent: () => import('./inbox/handoffs-inbox.page').then((m) => m.HandoffsInboxPage) },
];
