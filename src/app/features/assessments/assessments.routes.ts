import type { Routes } from '@angular/router';

/** `/:locale/assessments/...` (TECH-01..05). */
export const ASSESSMENTS_ROUTES: Routes = [
  { path: '', title: 'crm.assessments.title', loadComponent: () => import('./list/assessments-list.page').then((m) => m.AssessmentsListPage) },
  { path: ':id', title: 'crm.assessments.title', loadComponent: () => import('./detail/assessment-detail.page').then((m) => m.AssessmentDetailPage) },
];
