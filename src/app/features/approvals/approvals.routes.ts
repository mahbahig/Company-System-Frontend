import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';

/** `/:locale/approvals/...` (APPR-01..04, USER-06). */
export const APPROVALS_ROUTES: Routes = [
  { path: '', title: 'approvals.title', loadComponent: () => import('./list/approvals-list.page').then((m) => m.ApprovalsListPage) },
  {
    path: 'delegations',
    title: 'approvals.delegations.title',
    data: { permission: 'approvals.decide' },
    loadComponent: () => import('./delegations/approval-delegations.page').then((m) => m.ApprovalDelegationsPage),
  },
  {
    // The approval matrix's numbers (discount ceilings, margin floor, contract threshold, down payment, SLA).
    path: 'limits',
    title: 'ux.approvalLimits.title',
    data: { permission: 'settings.manage_policy' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./limits/approval-limits.page').then((m) => m.ApprovalLimitsPage),
  },
  { path: ':id', title: 'approvals.title', loadComponent: () => import('./detail/approval-detail.page').then((m) => m.ApprovalDetailPage) },
];
