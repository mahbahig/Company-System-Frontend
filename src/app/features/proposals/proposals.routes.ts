import type { Routes } from '@angular/router';

/** `/proposals/...` (TPROP, FPROP, PROP). The per-opportunity workspace lives under the opportunity. */
export const PROPOSALS_ROUTES: Routes = [
  { path: '', title: 'prop.listTitle', data: { permission: 'combined_proposals.view' }, loadComponent: () => import('./list/proposals-list.page').then((m) => m.ProposalsListPage) },
  { path: 'compare', title: 'prop.compareTitle', data: { permission: 'combined_proposals.view' }, loadComponent: () => import('./compare/proposal-compare.page').then((m) => m.ProposalComparePage) },
  { path: 'technical/:id', title: 'prop.tabs.technical', data: { permission: 'technical_proposals.view' }, loadComponent: () => import('./technical/technical-proposal.page').then((m) => m.TechnicalProposalPage) },
  { path: 'financial/:id', title: 'prop.tabs.financial', data: { permission: 'financial_proposals.view' }, loadComponent: () => import('./financial/financial-proposal.page').then((m) => m.FinancialProposalPage) },
  { path: 'combined/:id', title: 'prop.tabs.combined', data: { permission: 'combined_proposals.view' }, loadComponent: () => import('./combined/combined-proposal.page').then((m) => m.CombinedProposalPage) },
];
