import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';
import { notSupportDeskGuard } from './support-desk.guard';

/**
 * `/:locale/support/...` — Help & Support, open to every signed-in employee
 * (no permission: the API scopes each read to the caller's own tickets, or
 * all of them for the support desk). The desk files no tickets: its list is
 * `/admin/support-tickets`, and it opens tickets here only to answer them.
 */
export const SUPPORT_ROUTES: Routes = [
  {
    path: '',
    title: 'support.title',
    canActivate: [notSupportDeskGuard],
    loadComponent: () => import('./list/support-tickets.page').then((m) => m.SupportTicketsPage),
  },
  {
    path: 'new',
    title: 'support.newTitle',
    canActivate: [notSupportDeskGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./form/support-ticket-form.page').then((m) => m.SupportTicketFormPage),
  },
  {
    path: ':id',
    title: 'support.detail.title',
    loadComponent: () => import('./detail/support-ticket-detail.page').then((m) => m.SupportTicketDetailPage),
  },
];
