import type { Routes } from '@angular/router';

/** `/reports/...` (RPT-01..03). */
export const REPORTS_ROUTES: Routes = [
  { path: '', title: 'reports.title', loadComponent: () => import('./reports-catalogue.page').then((m) => m.ReportsCataloguePage) },
  { path: ':code', title: 'reports.title', loadComponent: () => import('./report-viewer.page').then((m) => m.ReportViewerPage) },
];
