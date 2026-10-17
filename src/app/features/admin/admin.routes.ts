import type { Routes } from '@angular/router';

/** `/:locale/admin/...` administration (ADM, USER, RBAC, AUD, AUTO, INT). */
export const ADMIN_ROUTES: Routes = [
  // Employees (formerly /admin/users) live at /employees; app.routes redirects the old paths.
  { path: 'roles', title: 'admin.roles.title', data: { permission: 'security.manage_roles' }, loadComponent: () => import('./roles/roles-admin.page').then((m) => m.RolesAdminPage) },
  { path: 'teams', title: 'admin.teams.title', data: { permission: 'administration.manage_teams' }, loadComponent: () => import('./teams/teams-admin.page').then((m) => m.TeamsAdminPage) },
  { path: 'reference-data', title: 'admin.reference.title', data: { permission: 'settings.manage' }, loadComponent: () => import('./reference/reference-admin.page').then((m) => m.ReferenceAdminPage) },
  { path: 'equipment', title: 'admin.equipment.title', data: { permission: ['catalog.manage', 'pricing.manage'] }, loadComponent: () => import('./equipment/equipment-admin.page').then((m) => m.EquipmentAdminPage) },
  { path: 'rules', title: 'admin.rules.title', data: { permission: 'settings.view' }, loadComponent: () => import('./rules/completeness-rules.page').then((m) => m.CompletenessRulesPage) },
  { path: 'intake-forms', title: 'admin.intakeForms.title', data: { permission: 'settings.manage' }, loadComponent: () => import('./intake-forms/intake-forms.page').then((m) => m.IntakeFormsPage) },
  { path: 'settings', title: 'admin.settings.title', data: { permission: ['settings.view', 'settings.manage_policy'] }, loadComponent: () => import('./settings/settings-admin.page').then((m) => m.SettingsAdminPage) },
  { path: 'automation', title: 'admin.automation.title', data: { permission: 'automation.manage' }, loadComponent: () => import('./automation/automation-admin.page').then((m) => m.AutomationAdminPage) },
  { path: 'integrations', title: 'admin.integrations.title', data: { permission: 'integrations.manage' }, loadComponent: () => import('./integrations/integrations-admin.page').then((m) => m.IntegrationsAdminPage) },
  { path: 'audit', title: 'admin.audit.title', data: { permission: ['audit.view', 'audit.view_security'] }, loadComponent: () => import('./audit/audit-log.page').then((m) => m.AuditLogPage) },
  { path: 'audit/:id', title: 'admin.audit.detail.title', data: { permission: ['audit.view', 'audit.view_security'] }, loadComponent: () => import('./audit/audit-event.page').then((m) => m.AuditEventPage) },
  { path: 'support-tickets', title: 'support.desk.title', data: { permission: 'support.manage' }, loadComponent: () => import('../support/manage/support-tickets-admin.page').then((m) => m.SupportTicketsAdminPage) },
];
