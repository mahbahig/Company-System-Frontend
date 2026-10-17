import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/forms/unsaved-changes';

/** `/customers/...` — lazy-loaded pages of the customers feature. */
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
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./form/customer-form.page').then((m) => m.CustomerFormPage),
  },
  {
    path: ':id/edit',
    title: 'crm.customers.editTitle',
    data: { permission: 'customers.edit' },
    canDeactivate: [unsavedChangesGuard],
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
    data: { permission: 'contacts.create' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./contacts/contact-create.page').then((m) => m.ContactCreatePage),
  },
  {
    path: ':id/sites/new',
    title: 'crm.sites.newTitle',
    data: { permission: 'sites.create' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./sites/site-form.page').then((m) => m.SiteFormPage),
  },
  {
    path: ':id/sites/:siteId/edit',
    title: 'crm.sites.editTitle',
    data: { permission: 'sites.edit' },
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./sites/site-form.page').then((m) => m.SiteFormPage),
  },
];
