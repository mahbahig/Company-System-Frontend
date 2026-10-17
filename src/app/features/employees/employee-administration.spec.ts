import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import type { RoleKey } from '../../../testing/role-permissions';
import { routes } from '../../app.routes';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService, type ConfirmRequest } from '../../shared/ui/confirm/confirm.service';
import { AdminApi, type AdminUser, type EmployeePerformance, type SecurityActivity } from '../admin/admin-api.service';
import { AuditLogPage } from '../admin/audit/audit-log.page';
import { EmployeeDetailPage } from './employee-detail.page';
import { EmployeesPage } from './employees.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const text = (root: Element) => root.textContent?.replace(/\s+/g, ' ') ?? '';
/** Buttons (or links) whose label is exactly `label` (tests render translation keys). */
const controls = (root: Element, label: string) => [...root.querySelectorAll<HTMLElement>('button, a')].filter((el) => el.textContent?.trim() === label);

const user = (id: string, roleCodes: string[], extra: Partial<AdminUser> = {}): AdminUser =>
  ({ id, email: `${id}@example.com`, fullNameAr: id, fullNameEn: `Name ${id}`, roleCodes, teamIds: [], territories: [], isActive: true, leadCapacity: 0, ...extra }) as AdminUser;
const performance = (u: Partial<EmployeePerformance['user']>): EmployeePerformance => ({
  user: { id: 'e1', fullNameAr: 'موظف', fullNameEn: 'Employee One', email: 'e1@example.com', roleCodes: ['sales_representative'], isActive: true, lastLoginAt: null, ...u },
  period: { from: null, to: null },
  leads: { owned: 0, open: 0, created: 0, converted: 0, closed: 0, contactAttempts: 0, reachedAttempts: 0 },
  calls: { total: 0, outbound: 0, inbound: 0, durationSeconds: 0, byOutcome: [] },
  meetings: { total: 0, completed: 0, upcoming: 0 },
  visits: { total: 0, completed: 0 },
  tasks: { open: 0, overdue: 0, completed: 0 },
  opportunities: { open: 0, won: 0, lost: 0 },
  recentActivity: [],
});
const SECURITY: SecurityActivity = {
  userId: 'e1',
  isActive: true,
  mfaEnabled: true,
  lastLoginAt: '2026-10-17T11:15:00.000Z',
  passwordChangedAt: null,
  lockedUntil: null,
  activeSessions: 2,
  successfulLogins: 7,
  successfulLogins30d: 3,
  failedLogins: 1,
  failedLogins30d: 1,
  lockouts: 0,
  passwordChanges: 1,
  recent: [{ id: 'a1', action: 'auth.login', actionLabel: { en: 'User logged into the system', ar: 'سجّل المستخدم الدخول إلى النظام' }, actorName: null, severity: 'info', ip: '10.0.0.7', occurredAt: '2026-10-17T11:15:00.000Z' }],
};

function configure(api: Record<string, unknown>) {
  const requests: ConfirmRequest[] = [];
  // Confirms at once — running the confirmed action first, as the real dialog does.
  const confirm = vi.fn(async (request: ConfirmRequest) => {
    requests.push(request);
    const result = request.action?.();
    if (result && typeof (result as Observable<unknown>).subscribe === 'function') await firstValueFrom(result as Observable<unknown>);
    else await result;
    return true;
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AdminApi, useValue: api },
      { provide: ConfirmService, useValue: { confirm, pending: signal(null), running: signal(false), failure: signal(null) } },
    ],
  });
  return { confirm, requests };
}

describe('Employees: management, isolation, colours and security activity', () => {
  describe('the Employees table', () => {
    async function table() {
      const rows = [user('u-system_administrator', ['system_administrator']), user('peer', ['system_administrator']), user('rep', ['sales_representative']), user('gone', ['telesales'], { isActive: false })];
      const api = { users: vi.fn(() => of({ rows, total: rows.length, page: 1, pageSize: 25, pageCount: 1 })), roles: vi.fn(() => of([])), teams: vi.fn(() => of([])), openWork: vi.fn(() => of([])) };
      configure(api);
      signInAs('system_administrator');
      const fixture = TestBed.createComponent(EmployeesPage);
      const root = await settle(fixture);
      const row = (id: string) => [...root.querySelectorAll('tbody tr')].find((tr) => text(tr).includes(`${id}@example.com`))!;
      return { root, row };
    }

    it('another Super Administrator’s row is read only — not even Edit', async () => {
      const { row } = await table();
      expect(row('peer').querySelectorAll('td:last-child button, td:last-child a')).toHaveLength(0);
      expect(text(row('peer'))).toContain('admin.users.protectedAccount');
    });

    it('each action has its own semantic colour (from the shared button variants) and an icon', async () => {
      const { row } = await table();
      const rep = row('rep');
      const [edit] = controls(rep, 'crm.common.edit');
      const [deactivate] = controls(rep, 'admin.users.deactivate');
      const [reset] = controls(rep, 'admin.users.resetPassword');
      const [logOut] = controls(rep, 'admin.users.forceLogout');
      expect(edit!.className).toContain('bg-primary/10');
      expect(deactivate!.className).toContain('bg-destructive/15');
      expect(reset!.className).toContain('bg-warning/15');
      expect(logOut!.className).toContain('bg-destructive/15');
      expect(controls(row('gone'), 'admin.users.activate')[0]!.className).toContain('bg-success/15');
      expect(controls(row('u-system_administrator'), 'admin.users.ownAccount')[0]!.className).toContain('bg-info/15');
      for (const button of [edit, deactivate, reset, logOut]) {
        expect(button!.querySelector('svg')).not.toBeNull();
        expect(button!.className).toContain('focus-visible:ring-2');
      }
    });
  });

  describe('an employee’s page', () => {
    async function detail(role: RoleKey, target: Partial<EmployeePerformance['user']> = {}) {
      const id = target.id ?? 'e1';
      const api = {
        performance: vi.fn(() => of(performance(target))),
        userSessions: vi.fn(() => of([])),
        user: vi.fn(() => of(user(id, target.roleCodes ?? ['sales_representative'], { fullNameEn: 'Employee One' }))),
        roles: vi.fn(() => of([])),
        teams: vi.fn(() => of([])),
        openWork: vi.fn(() => of([])),
        securityActivity: vi.fn(() => of(SECURITY)),
        resetPassword: vi.fn(() => of({ temporaryPassword: 'Temp-Pass-123' })),
        revokeAllUserSessions: vi.fn(() => of({ revokedSessions: 2 })),
        activate: vi.fn(() => of({})),
        deactivate: vi.fn(() => of({})),
      };
      const { requests } = configure(api);
      signInAs(role);
      const fixture = TestBed.createComponent(EmployeeDetailPage);
      fixture.componentRef.setInput('id', id);
      return { api, requests, fixture, root: await settle(fixture) };
    }

    it('the Super Administrator manages a normal employee right there: Edit, Deactivate, Reset Password, Log Out All Sessions', async () => {
      const { root } = await detail('system_administrator');
      const card = root.querySelector('[data-testid="employee-management"]')!;
      for (const label of ['crm.common.edit', 'admin.users.deactivate', 'admin.users.resetPassword', 'admin.users.forceLogout']) expect(controls(card, label), label).toHaveLength(1);
    });

    it('Reset Password asks a contextual warning confirmation, runs it, and shows the temporary password once', async () => {
      const { root, api, requests, fixture } = await detail('system_administrator');
      controls(root, 'admin.users.resetPassword')[0]!.click();
      await settle(fixture);
      expect(requests[0]).toMatchObject({ variant: 'warning', heading: 'admin.users.confirm.resetTitle', confirmLabel: 'admin.users.confirm.resetAction' });
      expect(requests[0]!.details).toHaveLength(3);
      expect(api.resetPassword).toHaveBeenCalledWith('e1');
      expect(text(root)).toContain('Temp-Pass-123');
    });

    it('Log Out All Sessions is a danger confirmation named after the action', async () => {
      const { root, api, requests, fixture } = await detail('system_administrator');
      controls(root.querySelector('[data-testid="employee-management"]')!, 'admin.users.forceLogout')[0]!.click();
      await settle(fixture);
      expect(requests[0]).toMatchObject({ variant: 'danger', confirmLabel: 'admin.users.confirm.logoutAction' });
      expect(api.revokeAllUserSessions).toHaveBeenCalledWith('e1');
    });

    it('Security Activity is a summary (real counts, last sign-in) with "View Audit Logs" — no audit table embedded', async () => {
      const { root, api } = await detail('system_administrator');
      const section = root.querySelector('[data-testid="employee-security-activity"]')!;
      expect(api.securityActivity).toHaveBeenCalledWith('e1');
      expect(section.querySelector('[data-testid="successful-logins"]')!.textContent!.trim()).toBe(TestBed.inject(I18nService).formatNumber(7));
      expect(section.querySelector('[data-testid="last-login"]')).not.toBeNull();
      // The audit records themselves live on the Audit Logs page only: no table, no list of events here.
      expect(root.querySelector('table[data-testid="employee-audit"], [data-testid="employee-audit-logs"]')).toBeNull();
      expect(section.querySelector('table, ul')).toBeNull();
      expect(text(section)).not.toContain('employees.security.recent');
      expect(text(section)).not.toContain('auth.login');
      const link = section.querySelector<HTMLAnchorElement>('[data-testid="view-audit-logs"]')!;
      expect(link.textContent!.trim()).toContain('employees.security.viewAuditLogs');
      expect(link.getAttribute('href')).toMatch(/\/admin\/audit\?userId=e1$/);
    });

    it('another Super Administrator’s page: read only — no management, no security activity, nothing requested', async () => {
      const { root, api } = await detail('system_administrator', { id: 'peer', roleCodes: ['system_administrator'] });
      expect(root.querySelector('[data-testid="employee-management"]')).toBeNull();
      expect(root.querySelector('[data-testid="employee-security-activity"]')).toBeNull();
      expect(root.querySelector('[data-testid="peer-admin-read-only"]')).not.toBeNull();
      expect(api.user).not.toHaveBeenCalled();
      expect(api.securityActivity).not.toHaveBeenCalled();
    });

    it('nobody but the Super Administrator sees management or security activity (the CEO, a sales manager)', async () => {
      for (const role of ['ceo', 'sales_manager'] as RoleKey[]) {
        TestBed.resetTestingModule();
        const { root, api } = await detail(role);
        expect(root.querySelector('[data-testid="employee-management"]'), role).toBeNull();
        expect(root.querySelector('[data-testid="employee-security-activity"]'), role).toBeNull();
        expect(controls(root, 'employees.security.viewAuditLogs'), role).toHaveLength(0);
        expect(api.securityActivity, role).not.toHaveBeenCalled();
        expect(api.user, role).not.toHaveBeenCalled();
      }
    });
  });

  it('the audit log opened from "View Audit Logs" asks the API for that employee', async () => {
    configure({});
    signInAs('system_administrator');
    const fixture = TestBed.createComponent(AuditLogPage);
    fixture.componentRef.setInput('userId', 'e1');
    await settle(fixture);
    const http = TestBed.inject(HttpTestingController);
    const call = http.match((request) => request.url.endsWith('/audit'))[0]!;
    expect(call.request.params.get('userId')).toBe('e1');
    expect((fixture.nativeElement as HTMLElement).querySelector('#au-employee')).not.toBeNull();
  });

  it('times are on the 12-hour clock with AM/PM (the one central formatter)', () => {
    configure({});
    const i18n = TestBed.inject(I18nService);
    i18n.locale.set('en');
    // Cairo time: 11:15 UTC → 2:15 PM; 21:15 UTC the day before → 12:15 AM.
    expect(i18n.formatDate('2026-10-17T11:15:00.000Z', true)).toMatch(/2:15\sPM/);
    expect(i18n.formatDate('2026-10-16T21:15:00.000Z', true)).toMatch(/12:15\sAM/);
    expect(i18n.formatDate('2026-10-17T11:15:00.000Z', true)).not.toMatch(/14:15/);
    i18n.locale.set('ar');
    expect(i18n.formatDate('2026-10-17T11:15:00.000Z', true)).toMatch(/[مص]/);
  });
});
