import type { Routes } from '@angular/router';

/** `/contracts/...` (CONTR-01..08). */
export const CONTRACTS_ROUTES: Routes = [
  { path: '', title: 'contracts.title', loadComponent: () => import('./list/contracts-list.page').then((m) => m.ContractsListPage) },
  { path: ':id', title: 'contracts.title', loadComponent: () => import('./detail/contract-detail.page').then((m) => m.ContractDetailPage) },
];
