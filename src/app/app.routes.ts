import type { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { ADMIN_ROUTES } from './features/admin/admin.routes';
import { guestGuard } from './core/auth/guest.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { fallbackLocaleGuard } from './core/i18n/fallback-locale.guard';
import { localeGuard } from './core/i18n/locale.guard';
import { localeRedirectGuard } from './core/i18n/locale-redirect.guard';

/**
 * `/:locale/...` exactly like the Next app. Every feature page is lazy-loaded
 * and declares `data.permission` (UX gate; the API re-checks everything).
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
            path: 'dashboard',
            title: 'dashboard.title',
            data: { permission: 'dashboards.view_own' },
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
            loadChildren: () => import('./features/assessments/assessments.routes').then((m) => m.ASSESSMENTS_ROUTES),
          },
          {
            path: 'proposals',
            data: { permission: ['combined_proposals.view', 'technical_proposals.view', 'financial_proposals.view'] },
            loadChildren: () => import('./features/proposals/proposals.routes').then((m) => m.PROPOSALS_ROUTES),
          },
          {
            path: 'contracts',
            data: { permission: 'contracts.view' },
            loadChildren: () => import('./features/contracts/contracts.routes').then((m) => m.CONTRACTS_ROUTES),
          },
          {
            path: 'projects',
            data: { permission: 'projects.view' },
            loadChildren: () => import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
          },
          {
            path: 'handoffs',
            data: { permission: 'handoffs.view' },
            loadChildren: () => import('./features/handoffs/handoffs.routes').then((m) => m.HANDOFFS_ROUTES),
          },
          {
            path: 'approvals',
            data: { permission: 'approvals.view' },
            loadChildren: () => import('./features/approvals/approvals.routes').then((m) => m.APPROVALS_ROUTES),
          },
          {
            path: 'search',
            title: 'search.title',
            loadComponent: () => import('./features/analytics/search/search.page').then((m) => m.SearchPage),
          },
          {
            path: 'customers',
            data: { permission: 'customers.view' },
            loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
          },
          {
            path: 'leads',
            data: { permission: 'leads.view' },
            loadChildren: () => import('./features/leads/leads.routes').then((m) => m.LEADS_ROUTES),
          },
          {
            path: 'opportunities',
            data: { permission: 'opportunities.view' },
            loadChildren: () => import('./features/opportunities/opportunities.routes').then((m) => m.OPPORTUNITIES_ROUTES),
          },
          {
            path: 'pipeline',
            data: { permission: 'opportunities.view' },
            loadChildren: () => import('./features/pipeline/pipeline.routes').then((m) => m.PIPELINE_ROUTES),
          },
          {
            path: 'reports',
            data: { permission: ['reports.view', 'reports.view_all'] },
            loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
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
            loadChildren: () => import('./features/imports/imports.routes').then((m) => m.IMPORTS_ROUTES),
          },
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
            loadChildren: () => import('./features/activities/activities.routes').then((m) => m.CALLS_ROUTES),
          },
          {
            path: 'meetings',
            data: { permission: 'meetings.view' },
            loadChildren: () => import('./features/activities/activities.routes').then((m) => m.MEETINGS_ROUTES),
          },
          {
            path: 'visits',
            data: { permission: 'visits.view' },
            loadChildren: () => import('./features/activities/activities.routes').then((m) => m.VISITS_ROUTES),
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
            loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
          },
          {
            path: 'notifications',
            loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
          },
          {
            path: 'account',
            loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
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
