import type { Routes } from '@angular/router';

/** `/projects/...` (PROJ-01..10). */
export const PROJECTS_ROUTES: Routes = [
  { path: '', title: 'projects.title', loadComponent: () => import('./list/projects-list.page').then((m) => m.ProjectsListPage) },
  { path: ':id', title: 'projects.title', loadComponent: () => import('./detail/project-detail.page').then((m) => m.ProjectDetailPage) },
];
