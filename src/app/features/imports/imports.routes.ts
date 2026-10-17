import type { Routes } from '@angular/router';

/** `/imports/...` (DUP-09, DUP-10). */
export const IMPORTS_ROUTES: Routes = [
  { path: '', title: 'imports.title', loadComponent: () => import('./imports-list.page').then((m) => m.ImportsListPage) },
  { path: ':id', title: 'imports.title', loadComponent: () => import('./import-job.page').then((m) => m.ImportJobPage) },
];
