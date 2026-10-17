import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { NEVER, of } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { routes } from '../../app.routes';
import { DialogComponent } from '../../shared/ui/dialog/dialog.component';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { AdminApi, type AdminUser } from '../admin/admin-api.service';
import { AnalyticsApi } from '../analytics/analytics-api.service';
import { EmployeeEditorComponent } from '../employees/employee-editor.component';
import { EmployeesPage } from '../employees/employees.page';
import { SupportTicketsAdminPage } from '../support/manage/support-tickets-admin.page';
import { SupportSeverityBadgeComponent } from '../support/shared/support-severity-badge.component';
import { SupportApi } from '../support/support-api.service';
import { DashboardPage } from './dashboard.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** An analytics client whose every dashboard call stays pending, except the list of dashboards the role opens. */
function analytics(dashboards: string[]) {
  return new Proxy({}, { get: (_target, key) => (key === 'available' ? () => of({ dashboards }) : () => NEVER) });
}

function configure(providers: unknown[]): void {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true), pending: signal(null) } }, ...(providers as never[])],
  });
}

describe('Super Administrator dashboard, ticket severity, employee creation and dialogs', () => {
  describe('the main dashboard', () => {
    const ALL = ['personal', 'executive', 'sales', 'marketing', 'operational', 'finance', 'platform'];

    it('the Super Administrator gets the support desk counts and platform health — no business dashboards, filters or quick links', async () => {
      const stats = vi.fn(() => of({ newTickets: 7, criticalNewTickets: 2 }));
      configure([{ provide: AnalyticsApi, useValue: analytics(ALL) }, { provide: SupportApi, useValue: { stats } }]);
      signInAs('system_administrator');
      const root = await settle(TestBed.createComponent(DashboardPage));
      expect(stats).toHaveBeenCalledTimes(1);
      expect(root.querySelector('app-support-overview')).not.toBeNull();
      expect(root.querySelector('app-platform-dashboard')).not.toBeNull();
      for (const business of ['app-tabs', 'app-quick-access', 'app-analytics-filter-bar', 'app-executive-dashboard', 'app-sales-dashboard', 'app-marketing-dashboard', 'app-operational-dashboard', 'app-finance-dashboard', 'app-personal-dashboard']) {
        expect(root.querySelector(business), business).toBeNull();
      }
      const cards = [...root.querySelectorAll('app-support-overview app-stat-card')];
      expect(cards.map((card) => card.querySelector('a')?.textContent?.trim())).toEqual(['7', '2']);
      const hrefs = cards.map((card) => decodeURIComponent(card.querySelector('a')!.getAttribute('href') ?? ''));
      expect(hrefs[0]).toMatch(/\/admin\/support-tickets\?status=pending(,|%2C)reopened$/);
      expect(hrefs[1]).toMatch(/\/admin\/support-tickets\?status=pending(,|%2C)reopened&severity=critical$/);
    });

    it('the business pages stay reachable for the Super Administrator (only the dashboard changed)', async () => {
      configure([{ provide: AnalyticsApi, useValue: analytics(ALL) }, { provide: SupportApi, useValue: { stats: () => NEVER } }]);
      signInAs('system_administrator');
      const { NavigationService } = await import('../../core/navigation/navigation.service');
      const navigation = TestBed.inject(NavigationService);
      for (const path of ['/dashboard/executive', '/pipeline', '/reports', '/exceptions', '/leads', '/opportunities']) expect(navigation.canOpen(path), path).toBe(true);
    });

    it('the CEO keeps the business dashboards and sees no support counts', async () => {
      const stats = vi.fn(() => of({ newTickets: 1, criticalNewTickets: 1 }));
      configure([{ provide: AnalyticsApi, useValue: analytics(['personal', 'executive', 'sales']) }, { provide: SupportApi, useValue: { stats } }]);
      signInAs('ceo');
      const root = await settle(TestBed.createComponent(DashboardPage));
      expect(root.querySelector('app-tabs')).not.toBeNull();
      expect(root.querySelector('app-support-overview')).toBeNull();
      expect(stats).not.toHaveBeenCalled();
    });
  });

  describe('ticket severity', () => {
    it('critical stands out (destructive tone, warning icon, bold); the others are plain toned badges', async () => {
      configure([]);
      const critical = TestBed.createComponent(SupportSeverityBadgeComponent);
      critical.componentRef.setInput('severity', 'critical');
      const root = await settle(critical);
      expect(root.querySelector('app-badge')!.className).toContain('font-semibold');
      expect(root.querySelector('app-icon')).not.toBeNull();
      expect(root.textContent).toContain('support.severity.critical');
      const low = TestBed.createComponent(SupportSeverityBadgeComponent);
      low.componentRef.setInput('severity', 'low');
      expect((await settle(low)).querySelector('app-icon')).toBeNull();
    });

    it('the desk sends the severity and status filters to the API (an unknown severity is not sent)', async () => {
      const all = vi.fn(() => of({ rows: [], total: 0, page: 1, pageSize: 25, pageCount: 0 }));
      configure([{ provide: SupportApi, useValue: { all } }]);
      signInAs('system_administrator');
      const fixture = TestBed.createComponent(SupportTicketsAdminPage);
      fixture.componentRef.setInput('status', 'pending');
      fixture.componentRef.setInput('severity', 'critical');
      await settle(fixture);
      expect(all).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'pending', severity: 'critical' }));
      fixture.componentRef.setInput('severity', 'urgent');
      await settle(fixture);
      expect(all).toHaveBeenLastCalledWith(expect.objectContaining({ severity: undefined }));
    });
  });

  describe('creating an employee', () => {
    function employeesPage() {
      const createUser = vi.fn(() => of({ user: { id: 'new' } as AdminUser }));
      configure([
        {
          provide: AdminApi,
          useValue: {
            users: () => of({ rows: [], total: 0, page: 1, pageSize: 25, pageCount: 0 }),
            roles: () => of([{ code: 'sales_representative', nameAr: 'مندوب', nameEn: 'Sales Representative' }]),
            teams: () => of([]),
            openWork: () => of([]),
            createUser,
          },
        },
      ]);
      signInAs('system_administrator');
      const fixture = TestBed.createComponent(EmployeesPage);
      return { fixture, createUser, page: fixture.componentInstance as unknown as { edit(user: AdminUser | null): void } };
    }
    /** The New / Edit employee dialog the page hosts (its form lives in `EmployeeEditorComponent`). */
    const editorOf = (fixture: ComponentFixture<EmployeesPage>) =>
      fixture.debugElement.query(By.directive(EmployeeEditorComponent)).componentInstance as unknown as { set(key: string, value: string): void; toggle(key: string, value: string, on: boolean): void; valid(): boolean };
    const type = (root: HTMLElement, id: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    it('the administrator types the initial password twice; it must meet the policy and match before anything is sent', async () => {
      const { fixture, createUser, page } = employeesPage();
      await settle(fixture);
      page.edit(null);
      await settle(fixture);
      const editor = editorOf(fixture);
      editor.set('email', 'hire@ecotech.test');
      editor.set('fullNameAr', 'موظف');
      editor.set('fullNameEn', 'New Hire');
      editor.toggle('roleCodes', 'sales_representative', true);
      const root = await settle(fixture);
      expect(root.querySelector('#u-password')).not.toBeNull();
      expect(root.querySelector('#u-password')!.getAttribute('type')).toBe('password');
      expect(editor.valid()).toBe(false);
      type(root, 'u-password', 'abc12');
      await settle(fixture);
      expect(root.querySelector('#u-password-hint')!.textContent).toContain('server.validation.passwordTooShort');
      type(root, 'u-password', 'InitialPassword123!');
      type(root, 'u-password-confirm', 'InitialPassword124!');
      await settle(fixture);
      expect(root.querySelector('#u-password-mismatch')).not.toBeNull();
      expect(editor.valid()).toBe(false);
      type(root, 'u-password-confirm', 'InitialPassword123!');
      await settle(fixture);
      expect(editor.valid()).toBe(true);
      root.querySelector<HTMLFormElement>('app-dialog form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'hire@ecotech.test', password: 'InitialPassword123!', confirmPassword: 'InitialPassword123!' }));
    });

    it('editing an existing employee asks for no password', async () => {
      const { fixture, page } = employeesPage();
      await settle(fixture);
      page.edit({ id: 'e1', email: 'e1@x.test', fullNameAr: 'م', fullNameEn: 'E', roleCodes: ['sales_representative'], teamIds: [], territories: [], isActive: true } as unknown as AdminUser);
      const root = await settle(fixture);
      expect(root.querySelector('#u-password')).toBeNull();
    });
  });

  describe('dialogs', () => {
    it('the header (title and close) sits outside the scrolling body, so it never scrolls away', async () => {
      configure([]);
      const fixture = TestBed.createComponent(DialogComponent);
      fixture.componentRef.setInput('heading', 'New employee');
      fixture.componentRef.setInput('open', true);
      const root = await settle(fixture);
      const dialog = root.querySelector('dialog')!;
      const [header, body] = [...dialog.children] as HTMLElement[];
      expect(dialog.className).toContain('overflow-hidden');
      expect(dialog.className).not.toContain('overflow-y-auto');
      expect(header.querySelector('h2')!.textContent).toContain('New employee');
      expect(header.querySelector('button')).not.toBeNull();
      expect(header.className).toContain('shrink-0');
      expect(body.className).toContain('overflow-y-auto');
      expect(body.contains(header)).toBe(false);
    });
  });
});
