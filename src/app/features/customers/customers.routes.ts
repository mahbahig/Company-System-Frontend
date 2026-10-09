import type { Routes } from '@angular/router';

/** `/:locale/customers/...` — lazy-loaded pages of the customers feature. */
export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    title: 'crm.customers.title',
    loadComponent: () => import('./list/customers-list.page').then((m) => m.CustomersListPage),
  },
  {
    path: 'new',
    title: 'crm.customers.newTitle',
    data: { permission: 'customers.create' },
    loadComponent: () => import('./form/customer-form.page').then((m) => m.CustomerFormPage),
  },
  {
    path: ':id/edit',
    title: 'crm.customers.editTitle',
    data: { permission: 'customers.edit' },
    loadComponent: () => import('./form/customer-form.page').then((m) => m.CustomerFormPage),
  },
  {
    path: ':id',
    title: 'crm.customers.title',
    loadComponent: () => import('./detail/customer-detail.page').then((m) => m.CustomerDetailPage),
  },
  {
    path: ':id/contacts/new',
    title: 'crm.contacts.new',
    loadComponent: () => import('./contacts/contact-create.page').then((m) => m.ContactCreatePage),
  },
  {
    path: ':id/sites/new',
    title: 'crm.sites.newTitle',
    loadComponent: () => import('./sites/site-form.page').then((m) => m.SiteFormPage),
  },
  {
    path: ':id/sites/:siteId/edit',
    title: 'crm.sites.editTitle',
    loadComponent: () => import('./sites/site-form.page').then((m) => m.SiteFormPage),
  },
];
