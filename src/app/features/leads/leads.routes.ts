import type { Routes } from '@angular/router';

/**
 * `/:locale/leads/...` — lazy-loaded pages of the leads feature. Static
 * segments (`quick-add`, `mine`, `distribute`, `new`) and the `:id/...`
 * variants are declared before the bare `:id` so the router does not treat
 * them as a lead id.
 */
export const LEADS_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.leads.title',
    loadComponent: () => import('./list/leads-list.page').then((m) => m.LeadsListPage),
  },
  {
    path: 'quick-add',
    title: 'crm.leads.quickAdd.title',
    loadComponent: () => import('./quick-add/lead-quick-add.page').then((m) => m.LeadQuickAddPage),
  },
  {
    path: 'mine',
    title: 'crm.leads.mineTitle',
    loadComponent: () => import('./mine/leads-mine.page').then((m) => m.LeadsMinePage),
  },
  {
    path: 'distribute',
    title: 'crm.leads.distribute.title',
    loadComponent: () => import('./distribute/leads-distribute.page').then((m) => m.LeadsDistributePage),
  },
  {
    path: 'new',
    title: 'crm.leads.newTitle',
    loadComponent: () => import('./form/lead-form.page').then((m) => m.LeadFormPage),
  },
  {
    path: ':id/edit',
    title: 'crm.leads.editTitle',
    loadComponent: () => import('./form/lead-form.page').then((m) => m.LeadFormPage),
  },
  {
    path: ':id/convert',
    title: 'crm.leads.convert.title',
    loadComponent: () => import('./convert/lead-convert.page').then((m) => m.LeadConvertPage),
  },
  {
    path: ':id',
    title: 'crm.leads.title',
    loadComponent: () => import('./detail/lead-detail.page').then((m) => m.LeadDetailPage),
  },
];
