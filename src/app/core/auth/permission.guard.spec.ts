import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';

import { signInAs } from '../../../testing/as-role';
import { AuthService } from './auth.service';
import { permissionGuard } from './permission.guard';

function snapshot(permission: unknown): ActivatedRouteSnapshot {
  return { data: permission === undefined ? {} : { permission }, parent: null } as unknown as ActivatedRouteSnapshot;
}

function run(permission: unknown, url = '/customers'): boolean | UrlTree {
  return TestBed.runInInjectionContext(() => permissionGuard(snapshot(permission), { url } as RouterStateSnapshot)) as boolean | UrlTree;
}

describe('permissionGuard (clicks, typed URLs, refreshes and deep links)', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    router = TestBed.inject(Router);
  });

  it('fails closed without a profile: back to sign-in', () => {
    const result = run('customers.view');
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toContain('/login');
  });

  it('lets a role through to a page its permission opens', () => {
    signInAs('sales_representative');
    expect(run('customers.view')).toBe(true);
  });

  it('sends a role without the permission to the forbidden page', () => {
    signInAs('installation_crew');
    const result = run('customers.view');
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('accepts any of several permissions', () => {
    signInAs('technical_lead');
    expect(run(['catalog.manage', 'pricing.manage'], '/admin/equipment')).toBe(true);
    signInAs('sales_representative');
    expect(router.serializeUrl(run(['catalog.manage', 'pricing.manage'], '/admin/equipment') as UrlTree)).toBe('/forbidden');
  });

  it('keeps a user with a forced password change on the account pages', () => {
    const user = signInAs('ceo');
    TestBed.inject(AuthService).user.set({ ...user, mustChangePassword: true });
    expect(router.serializeUrl(run(undefined, '/dashboard') as UrlTree)).toBe('/account/password');
  });
});
