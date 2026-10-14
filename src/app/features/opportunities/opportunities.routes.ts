import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';

/** `/:locale/opportunities/...` — lazy-loaded pages of the opportunities feature. */
export const OPPORTUNITIES_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.opportunities.title',
    loadComponent: () => import('./list/opportunities-list.page').then((m) => m.OpportunitiesListPage),
  },
  {
    path: 'new',
    title: 'crm.opportunities.newTitle',
    data: { permission: 'opportunities.create' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./form/opportunity-form.page').then((m) => m.OpportunityFormPage),
  },
  {
    path: ':id',
    title: 'crm.opportunities.title',
    loadComponent: () => import('./detail/opportunity-detail.page').then((m) => m.OpportunityDetailPage),
  },
  {
    path: ':id/intake',
    title: 'intake.title',
    data: { permission: 'intake.view' },
    loadComponent: () => import('../intake/intake.page').then((m) => m.IntakePage),
  },
  {
    path: ':id/proposals',
    title: 'prop.workspaceTitle',
    data: { permission: ['technical_proposals.view', 'financial_proposals.view', 'combined_proposals.view'] },
    loadComponent: () => import('../proposals/workspace/proposals-workspace.page').then((m) => m.ProposalsWorkspacePage),
  },
  {
    path: ':id/handoff',
    title: 'handoffs.title',
    data: { permission: 'handoffs.view' },
    loadComponent: () => import('../handoffs/detail/handoff.page').then((m) => m.HandoffPage),
  },
  {
    path: ':id/edit',
    title: 'crm.opportunities.editTitle',
    data: { permission: 'opportunities.edit' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./form/opportunity-form.page').then((m) => m.OpportunityFormPage),
  },
];
