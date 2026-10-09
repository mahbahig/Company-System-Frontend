import type { Routes } from '@angular/router';

/** `/:locale/pipeline` — the Kanban board. */
export const PIPELINE_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.pipeline.title',
    loadComponent: () => import('./pipeline.page').then((m) => m.PipelinePage),
  },
];
