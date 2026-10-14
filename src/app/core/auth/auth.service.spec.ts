import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { signInAs, userWithRoles } from '../../../testing/as-role';
import { AuthService } from './auth.service';

describe('AuthService.can (UI affordance — fails closed)', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
  });

  it('answers false without a signed-in profile', () => {
    expect(auth.can('customers.view')).toBe(false);
    expect(auth.canAny(['customers.view', 'leads.view'])).toBe(false);
  });

  it('respects the scope ladder own < team < all', () => {
    signInAs('sales_manager');
    expect(auth.can('leads.assign')).toBe(true);
    expect(auth.can('leads.assign', 'team')).toBe(true);
    expect(auth.can('leads.assign', 'all')).toBe(false);
  });

  it('denies an unknown scope value instead of treating it as own', () => {
    const user = userWithRoles('sales_representative');
    auth.user.set({ ...user, permissions: { 'customers.view': 'everything' as never } });
    expect(auth.can('customers.view')).toBe(false);
  });

  it('a read-only profile never gets a change, even if a write permission slipped in', () => {
    const exec = userWithRoles('read_only_executive');
    auth.user.set({ ...exec, permissions: { ...exec.permissions, 'customers.edit': 'all' } });
    expect(auth.isReadOnly()).toBe(true);
    expect(auth.can('customers.view')).toBe(true);
    expect(auth.can('customers.edit')).toBe(false);
  });

  it('the System Administrator holds every permission, business and security alike', () => {
    signInAs('system_administrator');
    for (const code of ['customers.view', 'leads.delete', 'approvals.decide', 'financials.view', 'audit.view', 'audit.view_security', 'security.manage_roles', 'security.manage_settings', 'administration.manage_users'] as const)
      expect(auth.can(code), code).toBe(true);
  });

  it('the CEO holds every business permission but no security administration', () => {
    signInAs('ceo');
    for (const code of ['customers.view', 'leads.view', 'calls.create', 'approvals.decide', 'settings.manage', 'settings.manage_policy', 'users.view_performance', 'reports.view'] as const)
      expect(auth.can(code), code).toBe(true);
    for (const code of ['audit.view', 'audit.view_security', 'security.manage_roles', 'security.manage_settings', 'security.view_sessions', 'administration.manage_users'] as const)
      expect(auth.can(code), code).toBe(false);
  });

  it('holding several roles merges their permissions but never the read-only lock', () => {
    signInAs('read_only_executive', 'project_manager');
    expect(auth.isReadOnly()).toBe(false);
    expect(auth.can('projects.manage')).toBe(true);
  });
});
