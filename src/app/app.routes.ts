import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { ADMIN_ROUTES } from './features/admin/admin.routes';
import { ACCOUNT_ROUTES } from './features/account/account.routes';
import { CALLS_ROUTES, MEETINGS_ROUTES, VISITS_ROUTES } from './features/activities/activities.routes';
import { APPROVALS_ROUTES } from './features/approvals/approvals.routes';
import { ASSESSMENTS_ROUTES } from './features/assessments/assessments.routes';
import { CONTRACTS_ROUTES } from './features/contracts/contracts.routes';
import { CUSTOMERS_ROUTES } from './features/customers/customers.routes';
import { EMPLOYEES_ROUTES } from './features/employees/employees.routes';
import { HANDOFFS_ROUTES } from './features/handoffs/handoffs.routes';
import { IMPORTS_ROUTES } from './features/imports/imports.routes';
import { LEADS_ROUTES } from './features/leads/leads.routes';
import { NOTIFICATIONS_ROUTES } from './features/notifications/notifications.routes';
import { OPPORTUNITIES_ROUTES } from './features/opportunities/opportunities.routes';
import { PIPELINE_ROUTES } from './features/pipeline/pipeline.routes';
import { PROJECTS_ROUTES } from './features/projects/projects.routes';
import { PROPOSALS_ROUTES } from './features/proposals/proposals.routes';
import { REPORTS_ROUTES } from './features/reports/reports.routes';
import { SUPPORT_ROUTES } from './features/support/support.routes';
import { TASKS_ROUTES } from './features/tasks/tasks.routes';

import { guestGuard } from './core/auth/guest.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { fallbackLocaleGuard } from './core/i18n/fallback-locale.guard';
import { localeGuard } from './core/i18n/locale.guard';
import { localeRedirectGuard } from './core/i18n/locale-redirect.guard';

/**
 * `/:locale/...` exactly like the Next app. Every feature page is lazy-loaded
 * and declares `data.permission` (UX gate; the API re-checks everything).
 * Feature route tables are static `children` (only their pages lazy-load) so
 * the navigation, command palette, breadcrumbs and notification links can
 * judge any in-app path with the same checks the route guard applies.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [localeRedirectGuard], children: [] },
  {
    // PROP-07 customer link (no sign-in, no locale prefix — the link is sent by e-mail / WhatsApp).
    path: 'p/:token',
    title: 'publicProposal.title',
    canActivate: [fallbackLocaleGuard],
    loadComponent: () => import('./features/public-proposal/public-proposal.page').then((m) => m.PublicProposalPage),
  },
  {
    path: ':locale',
    canActivate: [localeGuard],
    children: [
      {
        // Shared sign-in layout (and its 3D scene) stays mounted while moving
        // between these screens; URLs and guards are unchanged.
        path: '',
        loadComponent: () => import('./features/auth/shared/auth-layout.component').then((m) => m.AuthLayoutComponent),
        children: [
          {
            path: 'login',
            title: 'auth.login.title',
            canActivate: [guestGuard],
            loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
          },
          {
            path: 'forgot-password',
            title: 'account.forgot.title',
            canActivate: [guestGuard],
            loadComponent: () => import('./features/auth/password-reset/forgot-password.page').then((m) => m.ForgotPasswordPage),
          },
          {
            path: 'reset-password',
            title: 'account.reset.title',
            loadComponent: () => import('./features/auth/password-reset/reset-password.page').then((m) => m.ResetPasswordPage),
          },
        ],
      },
      {
        path: '',
        canActivate: [authGuard],
        canActivateChild: [permissionGuard],
        loadComponent: () => import('./core/layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            // Every signed-in user lands here; the page shows the dashboards their role opens (platform for the administrator).
            path: 'dashboard',
            title: 'dashboard.title',
            loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
          },
          {
            path: 'dashboard/executive',
            title: 'analytics.tabs.executive',
            data: { permission: 'dashboards.view_executive' },
            loadComponent: () => import('./features/dashboard/executive-dashboard.page').then((m) => m.ExecutiveDashboardPage),
          },
          {
            path: 'exceptions',
            title: 'exceptionsCenter.title',
            data: { permission: ['exceptions.view', 'data.view_quality'] },
            loadComponent: () => import('./features/analytics/exceptions/exceptions.page').then((m) => m.ExceptionsPage),
          },
          {
            path: 'assessments',
            data: { permission: 'assessments.view' },
            children: ASSESSMENTS_ROUTES,
          },
          {
            path: 'proposals',
            data: { permission: ['combined_proposals.view', 'technical_proposals.view', 'financial_proposals.view'] },
            children: PROPOSALS_ROUTES,
          },
          {
            path: 'contracts',
            data: { permission: 'contracts.view' },
            children: CONTRACTS_ROUTES,
          },
          {
            path: 'projects',
            data: { permission: 'projects.view' },
            children: PROJECTS_ROUTES,
          },
          {
            path: 'handoffs',
            data: { permission: 'handoffs.view' },
            children: HANDOFFS_ROUTES,
          },
          {
            path: 'approvals',
            data: { permission: 'approvals.view' },
            children: APPROVALS_ROUTES,
          },
          {
            path: 'search',
            title: 'search.title',
            loadComponent: () => import('./features/analytics/search/search.page').then((m) => m.SearchPage),
          },
          {
            path: 'customers',
            data: { permission: 'customers.view' },
            children: CUSTOMERS_ROUTES,
          },
          {
            path: 'leads',
            data: { permission: 'leads.view' },
            children: LEADS_ROUTES,
          },
          {
            path: 'opportunities',
            data: { permission: 'opportunities.view' },
            children: OPPORTUNITIES_ROUTES,
          },
          {
            // The sales kanban: sales and oversight roles; technical and delivery roles open their deals from the list.
            path: 'pipeline',
            data: {
              permission: ['opportunities.change_stage', 'opportunities.approve_stage', 'dashboards.view_company', 'dashboards.view_executive'],
              requiresAll: ['opportunities.view'],
            },
            children: PIPELINE_ROUTES,
          },
          {
            path: 'reports',
            data: { permission: ['reports.view', 'reports.view_all'] },
            children: REPORTS_ROUTES,
          },
          {
            path: 'campaigns',
            title: 'campaigns.title',
            data: { permission: 'campaigns.view' },
            loadComponent: () => import('./features/campaigns/campaigns.page').then((m) => m.CampaignsPage),
          },
          {
            path: 'imports',
            data: { permission: 'data.import' },
            children: IMPORTS_ROUTES,
          },
          {
            // The Employees page: account administration (System Administrator),
            // read-only oversight of everyone (CEO) or of a Sales Manager's own
            // Sales Representatives — the API scopes the list and every profile.
            path: 'employees',
            data: { permission: ['administration.manage_users', 'users.view_performance'] },
            children: EMPLOYEES_ROUTES,
          },
          // The page used to live at /admin/users: old links and bookmarks still arrive.
          { path: 'admin', pathMatch: 'full', redirectTo: 'employees' },
          { path: 'admin/users', pathMatch: 'full', redirectTo: 'employees' },
          { path: 'admin/users/:id', redirectTo: 'employees/:id' },
          {
            path: 'admin',
            // Static children (each page still lazy-loads) so the navigation can see /admin/* paths.
            children: ADMIN_ROUTES,
          },
          {
            path: 'duplicates',
            title: 'admin.duplicates.title',
            data: { permission: ['duplicates.review', 'customers.merge'] },
            loadComponent: () => import('./features/admin/duplicates/duplicates.page').then((m) => m.DuplicatesPage),
          },
          {
            path: 'ownership-requests',
            title: 'admin.ownership.title',
            data: { permission: ['ownership.request', 'ownership.decide'] },
            loadComponent: () => import('./features/admin/ownership/ownership-requests.page').then((m) => m.OwnershipRequestsPage),
          },
          {
            path: 'calls',
            data: { permission: 'calls.view' },
            children: CALLS_ROUTES,
          },
          {
            path: 'meetings',
            data: { permission: 'meetings.view' },
            children: MEETINGS_ROUTES,
          },
          {
            path: 'visits',
            data: { permission: 'visits.view' },
            children: VISITS_ROUTES,
          },
          {
            path: 'activities',
            title: 'act.log.title',
            data: { permission: 'activities.view' },
            loadComponent: () => import('./features/activities/log/activity-log.page').then((m) => m.ActivityLogPage),
          },
          {
            path: 'tasks',
            data: { permission: 'tasks.view' },
            children: TASKS_ROUTES,
          },
          {
            path: 'notifications',
            children: NOTIFICATIONS_ROUTES,
          },
          {
            // Help & Support: every signed-in employee (the API scopes what each one sees); the support desk only answers.
            path: 'support',
            children: SUPPORT_ROUTES,
          },
          {
            path: 'account',
            children: ACCOUNT_ROUTES,
          },
          {
            path: 'forbidden',
            title: 'errors.forbidden.title',
            loadComponent: () => import('./features/errors/forbidden.page').then((m) => m.ForbiddenPage),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    title: 'errors.notFound.title',
    canActivate: [fallbackLocaleGuard],
    loadComponent: () => import('./features/errors/not-found.page').then((m) => m.NotFoundPage),
  },
];
