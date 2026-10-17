import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import type { RoleKey } from '../../../testing/role-permissions';
import { routes } from '../../app.routes';
import { ApiError } from '../../core/api/api-error';
import { I18nService } from '../../core/i18n/i18n.service';
import { NavigationService } from '../../core/navigation/navigation.service';
import { SessionListComponent } from '../../shared/crm/session-list/session-list.component';
import type { UserSession } from '../../shared/crm/session-list/user-session.interface';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { AdminApi, type AdminUser, type EmployeePerformance } from '../admin/admin-api.service';
import { EmployeeDetailPage } from '../employees/employee-detail.page';
import { EmployeesPage } from '../employees/employees.page';
import { AccountApi } from './account-api.service';
import { ChangePasswordFormComponent } from './password/change-password-form.component';
import { ProfilePage } from './profile/profile.page';
import { ACCOUNT_ROUTES } from './account.routes';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const text = (root: Element) => root.textContent?.replace(/\s+/g, ' ') ?? '';
/** Buttons whose text is exactly `label` (tests render translation keys). */
const buttons = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].filter((button) => button.textContent?.trim() === label);

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const session = (id: string, current: boolean, os: string | null, browser: string | null, minutes: number, deviceType: UserSession['deviceType'] = 'desktop'): UserSession => ({
  id,
  current,
  os,
  browser,
  browserVersion: browser ? '141' : null,
  deviceType,
  ipAddress: '10.0.0.1',
  createdAt: ago(minutes + 60),
  lastActiveAt: ago(minutes),
  expiresAt: ago(-600),
});
/** As the API returns it: the current session first. */
const OWN: UserSession[] = [session('s-here', true, 'Windows 11', 'Chrome', 0), session('s-mac', false, 'macOS', 'Safari', 120), session('s-phone', false, 'Android', 'Chrome', 60 * 26, 'mobile')];

function configure(providers: unknown[] = []): { confirm: ReturnType<typeof vi.fn> } {
  // Confirms at once — running the confirmed action first, as the real dialog does.
  const confirm = vi.fn(async (request: { action?: () => unknown }) => {
    const result = request.action?.();
    if (result && typeof (result as { subscribe?: unknown }).subscribe === 'function') await firstValueFrom(result as Observable<unknown>);
    else await result;
    return true;
  });
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { confirm, pending: signal(null) } }, ...(providers as never[])],
  });
  return { confirm };
}

describe('Profile & sessions', () => {
  describe('navigation: every signed-in user has a Profile page', () => {
    it('/account opens the profile; every role may open it', () => {
      expect(ACCOUNT_ROUTES.find((route) => route.path === '')?.redirectTo).toBe('profile');
      configure();
      for (const role of ['installation_crew', 'sales_representative', 'read_only_executive', 'ceo', 'system_administrator'] as RoleKey[]) {
        signInAs(role);
        expect(TestBed.inject(NavigationService).canOpen('/account/profile')).toBe(true);
      }
    });
  });

  describe('session list', () => {
    it('shows OS · browser, "Current session", relative times with the exact time on hover — and no Log out on the current session', async () => {
      configure();
      const fixture = TestBed.createComponent(SessionListComponent);
      fixture.componentRef.setInput('sessions', [...OWN, session('s-odd', false, null, null, 3, 'unknown')]);
      fixture.componentRef.setInput('canRevoke', true);
      const root = await settle(fixture);
      const items = [...root.querySelectorAll('li')];
      expect(text(items[0]!)).toContain('Windows 11 · Chrome 141');
      expect(text(items[0]!)).toContain('sessions.current');
      expect(text(items[0]!)).toContain('sessions.justNow');
      expect(items[0]!.querySelector('button')).toBeNull();
      expect(items[0]!.getAttribute('aria-current')).toBe('true');
      expect(text(items[1]!)).toContain('macOS · Safari 141');
      // Relative times in the active language ("2 hours ago", "yesterday" …), the exact time on hover.
      const i18n = TestBed.inject(I18nService);
      expect(items[1]!.querySelector('time')!.textContent!.trim()).toBe(i18n.formatRelative(OWN[1]!.lastActiveAt));
      expect(items[1]!.querySelector('time')?.getAttribute('title')).toBeTruthy();
      expect(items[2]!.querySelector('time')!.textContent!.trim()).toBe(i18n.formatRelative(OWN[2]!.lastActiveAt));
      expect(text(items[3]!)).toContain('sessions.unknownOs · sessions.unknownBrowser');
      expect(items.slice(1).every((item) => !!item.querySelector('button'))).toBe(true);
    });

    it('without permission to end sessions there is no Log out at all', async () => {
      configure();
      const fixture = TestBed.createComponent(SessionListComponent);
      fixture.componentRef.setInput('sessions', OWN);
      fixture.componentRef.setInput('canRevoke', false);
      expect((await settle(fixture)).querySelectorAll('button').length).toBe(0);
    });
  });

  describe('Profile page', () => {
    function profileFor(role: RoleKey, api: Partial<AccountApi> = {}) {
      const sessions = vi.fn(() => of(OWN));
      const revokeSession = vi.fn(() => of(undefined));
      const avatarPolicy = () => of({ available: true, maxBytes: 5 * 1024 * 1024, acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'] });
      const { confirm } = configure([{ provide: AccountApi, useValue: { sessions, revokeSession, avatarPolicy, ...api } }]);
      signInAs(role);
      return { sessions, revokeSession, confirm, fixture: TestBed.createComponent(ProfilePage) };
    }

    it('shows the account, the password form and the own sessions — the current one first and without Log out', async () => {
      const { fixture } = profileFor('sales_representative');
      const root = await settle(fixture);
      expect(text(root)).toContain('sales_representative@ecotech.test');
      expect(root.querySelector('app-change-password-form')).not.toBeNull();
      const items = [...root.querySelectorAll('app-session-list li')];
      expect(items).toHaveLength(3);
      expect(text(items[0]!)).toContain('sessions.current');
      expect(items[0]!.querySelector('button')).toBeNull();
      expect(buttons(root, 'sessions.logOutAll')).toHaveLength(0);
    });

    it('logs out another session after confirmation, then shows the list again', async () => {
      const { fixture, revokeSession, confirm, sessions } = profileFor('sales_representative');
      const root = await settle(fixture);
      buttons(root, 'sessions.logOut')[0]!.click();
      await settle(fixture);
      expect(confirm).toHaveBeenCalled();
      expect(revokeSession).toHaveBeenCalledWith('s-mac');
      expect(sessions).toHaveBeenCalledTimes(2);
    });

    it('the Super Administrator gets exactly the same own-session controls', async () => {
      const { fixture, revokeSession } = profileFor('system_administrator');
      const root = await settle(fixture);
      expect(text(root.querySelectorAll('app-session-list li')[0]!)).toContain('sessions.current');
      expect(root.querySelectorAll('app-session-list li')[0]!.querySelector('button')).toBeNull();
      buttons(root, 'sessions.logOut')[1]!.click();
      await settle(fixture);
      expect(revokeSession).toHaveBeenCalledWith('s-phone');
      expect(buttons(root, 'sessions.logOutAll')).toHaveLength(0);
    });
  });

  describe('change password form', () => {
    function form(changePassword: AccountApi['changePassword']) {
      configure([{ provide: AccountApi, useValue: { changePassword } }]);
      signInAs('sales_representative');
      return TestBed.createComponent(ChangePasswordFormComponent);
    }
    const type = (root: HTMLElement, id: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    it('needs all three fields, a policy-compliant password and a matching confirmation before it sends anything', async () => {
      const changePassword = vi.fn(() => of(undefined));
      const fixture = form(changePassword);
      const root = await settle(fixture);
      const submit = root.querySelector<HTMLButtonElement>('button[type=submit]')!;
      expect(submit.disabled).toBe(true);
      type(root, 'cp-current', 'Old-Password-1');
      type(root, 'cp-password', 'weak');
      type(root, 'cp-confirm', 'weak');
      await settle(fixture);
      expect(submit.disabled).toBe(true);
      type(root, 'cp-password', 'New-Password-2026');
      type(root, 'cp-confirm', 'New-Password-2027');
      await settle(fixture);
      expect(submit.disabled).toBe(true);
      expect(root.querySelector('#cp-mismatch')).not.toBeNull();
      type(root, 'cp-confirm', 'New-Password-2026');
      await settle(fixture);
      expect(submit.disabled).toBe(false);
    });

    it('sends the three values, then clears them and reports the change (other devices signed out, this one stays)', async () => {
      const changePassword = vi.fn(() => of(undefined));
      const fixture = form(changePassword);
      const changed = vi.fn();
      fixture.componentInstance.changed.subscribe(changed);
      const root = await settle(fixture);
      type(root, 'cp-current', 'Old-Password-1');
      type(root, 'cp-password', 'New-Password-2026');
      type(root, 'cp-confirm', 'New-Password-2026');
      await settle(fixture);
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Old-Password-1', newPassword: 'New-Password-2026', confirmPassword: 'New-Password-2026' });
      expect(changed).toHaveBeenCalled();
      expect(root.querySelector<HTMLInputElement>('#cp-current')!.value).toBe('');
      expect(text(root)).toContain('account.password.changedHere');
    });

    it('a wrong current password is reported in words and nothing is cleared', async () => {
      const error = new ApiError(400, { message: 'errors.validation', fieldErrors: { currentPassword: 'validation.currentPasswordWrong' } });
      const fixture = form(vi.fn(() => throwError(() => error)));
      const root = await settle(fixture);
      type(root, 'cp-current', 'Wrong-Password-1');
      type(root, 'cp-password', 'New-Password-2026');
      type(root, 'cp-confirm', 'New-Password-2026');
      await settle(fixture);
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(root.querySelector('app-alert')).not.toBeNull();
      expect(root.querySelector<HTMLInputElement>('#cp-current')!.value).toBe('Wrong-Password-1');
    });
  });

  describe('an employee’s sessions on their page (Super Administrator only)', () => {
    const SECURITY = { userId: 'e1', isActive: true, mfaEnabled: false, lastLoginAt: null, passwordChangedAt: null, lockedUntil: null, activeSessions: 2, successfulLogins: 7, successfulLogins30d: 3, failedLogins: 1, failedLogins30d: 1, lockouts: 0, passwordChanges: 0, recent: [] };
    const performance = (user: Partial<EmployeePerformance['user']>): EmployeePerformance => ({
      user: { id: 'e1', fullNameAr: 'موظف', fullNameEn: 'Employee One', email: 'e1@example.com', roleCodes: ['sales_representative'], isActive: true, lastLoginAt: null, ...user },
      period: { from: null, to: null },
      leads: { owned: 0, open: 0, created: 0, converted: 0, closed: 0, contactAttempts: 0, reachedAttempts: 0 },
      calls: { total: 0, outbound: 0, inbound: 0, durationSeconds: 0, byOutcome: [] },
      meetings: { total: 0, completed: 0, upcoming: 0 },
      visits: { total: 0, completed: 0 },
      tasks: { open: 0, overdue: 0, completed: 0 },
      opportunities: { open: 0, won: 0, lost: 0 },
      recentActivity: [],
    });

    async function detail(role: RoleKey, user: Partial<EmployeePerformance['user']> = {}) {
      const api = {
        performance: vi.fn(() => of(performance(user))),
        userSessions: vi.fn(() => of([session('e-1', false, 'Windows 11', 'Chrome', 1), session('e-2', false, 'iOS', 'Safari', 90, 'mobile')])),
        revokeUserSession: vi.fn(() => of(undefined)),
        revokeAllUserSessions: vi.fn(() => of({ revokedSessions: 2 })),
        user: vi.fn(() => of({ id: user.id ?? 'e1', email: 'e1@example.com', fullNameAr: 'موظف', fullNameEn: 'Employee One', roleCodes: user.roleCodes ?? ['sales_representative'], teamIds: [], territories: [], isActive: true, leadCapacity: 0 })),
        roles: vi.fn(() => of([])),
        teams: vi.fn(() => of([])),
        securityActivity: vi.fn(() => of(SECURITY)),
      };
      const { confirm } = configure([{ provide: AdminApi, useValue: api }]);
      signInAs(role);
      const fixture = TestBed.createComponent(EmployeeDetailPage);
      fixture.componentRef.setInput('id', user.id ?? 'e1');
      return { api, confirm, fixture, root: await settle(fixture) };
    }

    it('the Super Administrator sees a normal employee’s sessions, ends one, and logs them out of all of them', async () => {
      const { api, fixture, root } = await detail('system_administrator');
      expect(api.userSessions).toHaveBeenCalledWith('e1');
      const items = [...root.querySelectorAll('app-employee-sessions li')];
      expect(items).toHaveLength(2);
      expect(items.every((item) => !text(item).includes('sessions.current'))).toBe(true);
      expect(text(items[0]!)).toContain('sessions.activeNow');
      buttons(root, 'sessions.logOut')[0]!.click();
      await settle(fixture);
      expect(api.revokeUserSession).toHaveBeenCalledWith('e1', 'e-1');
      buttons(root, 'sessions.logOutAll')[0]!.click();
      await settle(fixture);
      expect(api.revokeAllUserSessions).toHaveBeenCalledWith('e1');
    });

    it('never for another Super Administrator, nor for the viewer themself', async () => {
      const peer = await detail('system_administrator', { roleCodes: ['system_administrator'] });
      expect(peer.root.querySelector('app-employee-sessions')).toBeNull();
      expect(peer.api.userSessions).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
      const self = await detail('system_administrator', { id: 'u-system_administrator', roleCodes: ['system_administrator'] });
      expect(self.root.querySelector('app-employee-sessions')).toBeNull();
    });

    it('never for anyone without the session permission — the CEO or a sales manager', async () => {
      for (const role of ['ceo', 'sales_manager'] as RoleKey[]) {
        TestBed.resetTestingModule();
        const { root, api } = await detail(role);
        expect(root.querySelector('app-employee-sessions')).toBeNull();
        expect(api.userSessions).not.toHaveBeenCalled();
      }
    });
  });

  describe('the Employees list', () => {
    const user = (id: string, roleCodes: string[], extra: Partial<AdminUser> = {}): AdminUser =>
      ({ id, email: `${id}@example.com`, fullNameAr: id, fullNameEn: id, roleCodes, teamIds: [], territories: [], isActive: true, leadCapacity: 0, ...extra }) as AdminUser;

    it('offers lock, password reset and log-out-all for normal employees only — not for another Super Administrator or oneself', async () => {
      const rows = [user('u-system_administrator', ['system_administrator']), user('peer-admin', ['system_administrator']), user('rep', ['sales_representative'])];
      configure([
        {
          provide: AdminApi,
          useValue: {
            users: vi.fn(() => of({ rows, total: 3, page: 1, pageSize: 25, pageCount: 1 })),
            roles: vi.fn(() => of([])),
            teams: vi.fn(() => of([])),
            openWork: vi.fn(() => of([])),
            revokeAllUserSessions: vi.fn(() => of({ revokedSessions: 1 })),
          },
        },
      ]);
      signInAs('system_administrator');
      const fixture = TestBed.createComponent(EmployeesPage);
      const root = await settle(fixture);
      const rowText = (id: string) => text([...root.querySelectorAll('tbody tr')].find((row) => text(row as HTMLElement).includes(`${id}@example.com`)) as HTMLElement);
      expect(rowText('rep')).toContain('admin.users.deactivate');
      expect(rowText('rep')).toContain('admin.users.forceLogout');
      expect(rowText('peer-admin')).not.toMatch(/admin\.users\.(deactivate|resetPassword|forceLogout|activate)\b/);
      expect(rowText('peer-admin')).toContain('admin.users.protectedAccount');
      expect(rowText('u-system_administrator')).not.toMatch(/admin\.users\.(deactivate|resetPassword|forceLogout|activate)\b/);
      expect(rowText('u-system_administrator')).toContain('admin.users.ownAccount');
    });
  });
});
