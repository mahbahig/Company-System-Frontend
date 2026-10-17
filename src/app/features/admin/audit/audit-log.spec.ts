import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';

import { signInAs } from '../../../../testing/as-role';
import type { RoleKey } from '../../../../testing/role-permissions';
import { routes } from '../../../app.routes';
import { apiErrorInterceptor } from '../../../core/api/api-error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ADMIN_ROUTES } from '../admin.routes';
import type { AuditEntry } from './audit-entry.interface';
import { AuditEventPage } from './audit-event.page';
import { AuditLogPage } from './audit-log.page';

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

const entry = (id: string, extra: Partial<AuditEntry>): AuditEntry => ({
  id,
  occurredAt: '2026-10-17T14:42:00.000Z', // 5:42 PM in Cairo
  actorKind: 'user',
  actorName: 'Ahmed Mohamed',
  actorNameAr: 'أحمد محمد',
  action: 'auth.login',
  actionLabel: { en: 'User logged into the system', ar: 'سجّل المستخدم الدخول إلى النظام' },
  entityType: 'user',
  entityId: 'u1',
  changedFields: [],
  source: 'api',
  severity: 'info',
  ...extra,
});
const ROWS: AuditEntry[] = [
  entry('a1', {}),
  entry('a2', { action: 'support_ticket.status_change', actionLabel: { en: 'Changed the status of a support ticket', ar: 'غيّر حالة تذكرة دعم' }, actorName: 'Mahmoud Bahig', actorNameAr: 'محمود بهيج', entityType: 'support_ticket', changedFields: ['status'], severity: 'warning' }),
  entry('a3', { action: 'auth.login_failed', actionLabel: { en: 'Failed sign-in attempt', ar: 'محاولة تسجيل دخول فاشلة' }, actorKind: 'anonymous', actorName: null, actorNameAr: null }),
  entry('a4', { action: 'approval.escalated', actionLabel: { en: 'Escalated an overdue approval', ar: 'صعّد طلب موافقة متأخرًا' }, actorKind: 'system', actorName: null, actorNameAr: null, source: 'system' }),
];

function configure() {
  TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()] });
  signInAs('system_administrator');
  TestBed.inject(I18nService).locale.set('en');
  return TestBed.inject(HttpTestingController);
}

describe('Audit log', () => {
  async function list() {
    const http = configure();
    const fixture = TestBed.createComponent(AuditLogPage);
    await settle(fixture);
    http.match((request) => request.url.endsWith('/audit'))[0]!.flush({ success: true, rows: ROWS, total: ROWS.length, page: 1, pageSize: 25, pageCount: 1 });
    const root = await settle(fixture);
    return { fixture, root, rows: [...root.querySelectorAll<HTMLTableRowElement>('[data-testid="audit-row"]')] };
  }

  it('every row shows its date and time on the 12-hour clock, who did it and the readable action — never a raw code', async () => {
    const { rows, root } = await list();
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.querySelector('time')!.textContent).toMatch(/Oct 2026, 5:42\sPM/);
    expect(text(rows[0]!)).toContain('User logged into the system');
    expect(text(rows[0]!)).toContain('Ahmed Mohamed');
    expect(text(rows[1]!)).toContain('Changed the status of a support ticket');
    expect(text(rows[1]!)).toContain('Mahmoud Bahig');
    expect(text(rows[2]!)).toContain('admin.audit.anonymous');
    expect(text(rows[3]!)).toContain('admin.audit.system');
    for (const code of ['auth.login', 'support_ticket.status_change', 'approval.escalated']) expect(text(root.querySelector('tbody')!)).not.toContain(code);
    expect(text(root.querySelector('tbody')!)).not.toMatch(/\b(1[3-9]|2[0-3]):\d\d\b/);
  });

  it('a row is a link: pointer, hover and focus styles, an accessible name, and it opens the details by click or Enter', async () => {
    const { rows } = await list();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const row = rows[1]!;
    expect(row.getAttribute('role')).toBe('link');
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.className).toContain('cursor-pointer');
    expect(row.className).toContain('focus-visible:ring-2');
    expect(row.getAttribute('aria-label')).toBe('admin.audit.openEvent');
    row.click();
    expect(navigate).toHaveBeenLastCalledWith(['/', 'en', 'admin', 'audit', 'a2']);
    rows[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navigate).toHaveBeenLastCalledWith(['/', 'en', 'admin', 'audit', 'a3']);
  });

  describe('the event detail', () => {
    async function detail(body: AuditEntry | null) {
      const http = configure();
      const fixture = TestBed.createComponent(AuditEventPage);
      fixture.componentRef.setInput('id', 'a2');
      await settle(fixture);
      const call = http.expectOne((request) => request.url.endsWith('/audit/a2'));
      if (body) call.flush({ success: true, ...body });
      else call.flush({ message: 'errors.notFound' }, { status: 404, statusText: 'Not Found' });
      return settle(fixture);
    }

    it('shows the readable action, who, when (12-hour clock), severity and every change — no raw code', async () => {
      const root = await detail(entry('a2', { ...ROWS[1]!, before: { status: 'pending' }, after: { status: 'resolved' } }));
      expect(root.querySelector('[data-testid="audit-action"]')!.textContent!.trim()).toBe('Changed the status of a support ticket');
      expect(root.querySelector('[data-testid="audit-actor"]')!.textContent!.trim()).toBe('Mahmoud Bahig');
      expect(root.querySelector('[data-testid="audit-time"]')!.textContent).toMatch(/5:42\sPM/);
      expect(text(root)).toContain('pending');
      expect(text(root)).toContain('resolved');
      expect(text(root)).not.toContain('support_ticket.status_change');
    });

    it('an event outside the viewer’s audit log (404) shows "not found", nothing of it', async () => {
      const root = await detail(null);
      expect(root.querySelector('app-status-page')).not.toBeNull();
    });
  });

  it('the list and the detail are routes for the audit permissions only (critical notifications link to the detail)', () => {
    const detailRoute = ADMIN_ROUTES.find((route) => route.path === 'audit/:id')!;
    expect(detailRoute.data?.['permission']).toEqual(['audit.view', 'audit.view_security']);
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    for (const [role, open] of [['system_administrator', true], ['ceo', false], ['sales_manager', false], ['sales_representative', false]] as Array<[RoleKey, boolean]>) {
      signInAs(role);
      expect(TestBed.inject(NavigationService).canOpen('/admin/audit/66aa00000000000000000001'), role).toBe(open);
    }
  });
});
