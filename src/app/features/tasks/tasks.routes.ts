import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';

/** `/tasks/...` — lazy-loaded pages of the tasks feature. */
export const TASKS_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.tasks.title',
    loadComponent: () => import('./list/tasks-list.page').then((m) => m.TasksListPage),
  },
  {
    path: 'new',
    title: 'crm.tasks.newTitle',
    data: { permission: 'tasks.create' },
    canDeactivate: [unsavedChangesGuard],
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
    data: { permission: 'tasks.edit' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./form/task-form.page').then((m) => m.TaskFormPage),
  },
];
