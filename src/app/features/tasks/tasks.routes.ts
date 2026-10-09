import type { Routes } from '@angular/router';

/** `/:locale/tasks/...` — lazy-loaded pages of the tasks feature. */
export const TASKS_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.tasks.title',
    loadComponent: () => import('./list/tasks-list.page').then((m) => m.TasksListPage),
  },
  {
    path: 'new',
    title: 'crm.tasks.newTitle',
    loadComponent: () => import('./form/task-form.page').then((m) => m.TaskFormPage),
  },
  {
    path: ':id',
    title: 'crm.tasks.title',
    loadComponent: () => import('./detail/task-detail.page').then((m) => m.TaskDetailPage),
  },
  {
    path: ':id/edit',
    title: 'crm.tasks.editTitle',
    loadComponent: () => import('./form/task-form.page').then((m) => m.TaskFormPage),
  },
];
