import type { Routes } from '@angular/router';

/** `/:locale/approvals/...` (APPR-01..04, USER-06). */
export const APPROVALS_ROUTES: Routes = [
  { path: '', title: 'approvals.title', loadComponent: () => import('./list/approvals-list.page').then((m) => m.ApprovalsListPage) },
  {
    path: 'delegations',
    title: 'approvals.delegations.title',
    data: { permission: 'approvals.decide' },
    loadComponent: () => import('./delegations/approval-delegations.page').then((m) => m.ApprovalDelegationsPage),
  },
  { path: ':id', title: 'approvals.title', loadComponent: () => import('./detail/approval-detail.page').then((m) => m.ApprovalDetailPage) },
];
