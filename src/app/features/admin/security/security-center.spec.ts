import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { signInAs } from '../../../../testing/as-role';
import type { RoleKey } from '../../../../testing/role-permissions';
import { routes } from '../../../app.routes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ConfirmService, type ConfirmRequest } from '../../../shared/ui/confirm/confirm.service';
import { ADMIN_ROUTES } from '../admin.routes';
import { AdminApi } from '../admin-api.service';
import { SecurityApi, type SecurityAlert, type SecurityOverview, type SystemHealthReport } from './security-api.service';
import { SecurityAlertPage } from './security-alert.page';
import { SecurityCenterPage } from './security-center.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const testId = (root: Element, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const text = (root: Element | null) => root?.textContent?.replace(/\s+/g, ' ') ?? '';

const ALERT: SecurityAlert = {
  id: 'al1',
  type: 'repeated_failed_logins',
  severity: 'high',
  status: 'new',
  title: { en: 'Repeated failed sign-in attempts', ar: 'محاولات تسجيل دخول فاشلة متكررة' },
  description: { en: '5 failed sign-in attempts on this account within 15 minutes.', ar: '' },
  user: { id: 'u1', name: 'Ahmed Mohamed', nameAr: 'أحمد محمد' },
  ip: '203.0.113.9',
  eventCount: 3,
  firstSeenAt: '2026-10-17T11:00:00.000Z',
  lastSeenAt: '2026-10-17T11:31:00.000Z',
  relatedAuditEventId: 'ae1',
  acknowledgedAt: null,
  acknowledgedByName: null,
  resolvedAt: null,
  resolvedByName: null,
  resolutionNote: null,
};
const OVERVIEW: SecurityOverview = {
  generatedAt: '2026-10-17T11:35:00.000Z',
  authentication: { successfulLogins24h: 42, successfulLogins7d: 260, failedLoginsLastHour: 2, failedLogins24h: 7, failedLogins7d: 19, activeSessions: 11, revokedSessions7d: 4, lockedAccounts: 1, blockedIps: 1, deactivatedAccounts: 3 },
  security: { criticalEvents7d: 2, highEvents7d: 9, openAlerts: 1, newAlerts: 1, criticalAlerts: 0, highAlerts: 1, suspiciousAccounts: 1, repeatedFailures: [{ userId: 'u1', name: 'Ahmed Mohamed', nameAr: 'أحمد محمد', failures: 5, lastAt: '2026-10-17T11:31:00.000Z' }], mfa: { enabled: 9, disabled: 6, activeAccounts: 15 } },
  system: { mode: 'normal', locked: false, maintenance: false, health: { status: 'degraded', checkedAt: '2026-10-17T11:35:00.000Z', components: [] } },
  recentAlerts: [ALERT],
};
const HEALTH: SystemHealthReport = {
  status: 'degraded',
  checkedAt: '2026-10-17T11:35:00.000Z',
  components: [
    { key: 'api', status: 'healthy', core: true, latencyMs: null, reason: null, details: { uptimeSeconds: 7200, memoryMb: 210 }, checkedAt: '2026-10-17T11:35:00.000Z' },
    { key: 'database', status: 'healthy', core: true, latencyMs: 42, reason: null, details: { connected: true }, checkedAt: '2026-10-17T11:35:00.000Z' },
    { key: 'redis', status: 'healthy', core: false, latencyMs: 8, reason: null, details: { configured: true }, checkedAt: '2026-10-17T11:35:00.000Z' },
    { key: 'queues', status: 'degraded', core: false, latencyMs: 3, reason: 'failed_jobs', details: { queue: 'email', waiting: 0, active: 0, delayed: 0, failed: 17 }, checkedAt: '2026-10-17T11:35:00.000Z' },
    { key: 'storage', status: 'healthy', core: false, latencyMs: null, reason: null, details: { documentsWritable: true, uploadsProvider: 'cloudinary', uploadsAvailable: true }, checkedAt: '2026-10-17T11:35:00.000Z' },
    { key: 'email', status: 'healthy', core: false, latencyMs: null, reason: null, details: { configured: true, sent24h: 12, failed24h: 0, queued24h: 0 }, checkedAt: '2026-10-17T11:35:00.000Z' },
  ],
};

describe('Security Center (Super Administrator)', () => {
  type Mock = ReturnType<typeof vi.fn>;
  let api: { overview: Mock; activity: Mock; alerts: Mock; alert: Mock; acknowledge: Mock; resolve: Mock; health: Mock; systemState: Mock; enableMaintenance: Mock; disableMaintenance: Mock };
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = {
      overview: vi.fn(() => of(OVERVIEW)),
      activity: vi.fn(() => of([{ id: 'ae1', occurredAt: '2026-10-17T11:31:00.000Z', actorKind: 'user', actorName: 'Ahmed Mohamed', actorNameAr: 'أحمد محمد', action: 'auth.login', actionLabel: { en: 'User logged into the system', ar: 'سجّل المستخدم الدخول إلى النظام' }, entityType: 'user', changedFields: [], source: 'api', severity: 'info', ip: '10.0.0.7' }])),
      alerts: vi.fn(() => of({ rows: [ALERT], total: 1, page: 1, pageSize: 20, pageCount: 1 })),
      alert: vi.fn(() => of({ ...ALERT, events: [{ id: 'se1', type: ALERT.type, severity: 'high', title: ALERT.title, description: ALERT.description, user: ALERT.user, ip: ALERT.ip, device: { os: 'Windows 11', browser: 'Chrome', deviceType: 'desktop' }, sessionId: null, auditEventId: 'ae1', reviewed: false, reviewedAt: null, occurredAt: ALERT.lastSeenAt }] })),
      acknowledge: vi.fn(() => of({ ...ALERT, status: 'acknowledged' })),
      resolve: vi.fn(() => of({ ...ALERT, status: 'resolved' })),
      health: vi.fn(() => of(HEALTH)),
      systemState: vi.fn(() => of({ mode: 'normal', lock: { locked: false, changedAt: null, changedBy: null }, maintenance: { enabled: false, changedAt: null, changedBy: null } })),
      enableMaintenance: vi.fn(),
      disableMaintenance: vi.fn(),
    };
    confirm = vi.fn(async (request: ConfirmRequest) => {
      const result = request.action?.();
      if (result && typeof (result as { subscribe?: unknown }).subscribe === 'function') await firstValueFrom(result as Observable<unknown>);
      return true;
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SecurityApi, useValue: api },
        { provide: AdminApi, useValue: { lockSystem: vi.fn(), unlockSystem: vi.fn() } },
        { provide: ConfirmService, useValue: { confirm, pending: signal(null) } },
      ],
    });
    signInAs('system_administrator');
    TestBed.inject(I18nService).locale.set('en');
  });

  it('one page, in order: system status (with the health), the overview, recent activity, alerts and system health', async () => {
    const root = await settle(TestBed.createComponent(SecurityCenterPage));
    const order = ['system-status', 'security-overview', 'security-activity', 'security-alerts', 'system-health'].map((id) => root.innerHTML.indexOf(`data-testid="${id}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text(testId(root, 'system-health-summary'))).toContain('securityCenter.health.overall.degraded');
  });

  it('the overview shows the API’s numbers — sign-ins, sessions, alerts, two-factor adoption, repeated failures', async () => {
    const root = await settle(TestBed.createComponent(SecurityCenterPage));
    const auth = text(testId(root, 'security-overview-auth'));
    for (const value of ['42', '7', '11', '4', '3']) expect(auth).toContain(value);
    const security = text(testId(root, 'security-overview-security'));
    expect(security).toContain('60%');
    expect(text(testId(root, 'repeated-failures'))).toContain('Ahmed Mohamed');
  });

  it('recent activity reads as person · action · time, never a raw code', async () => {
    const root = await settle(TestBed.createComponent(SecurityCenterPage));
    const row = testId(root, 'security-activity-row')!;
    expect(text(row)).toContain('Ahmed Mohamed');
    expect(text(row)).toContain('User logged into the system');
    expect(text(row)).toMatch(/(AM|PM)/);
    expect(text(row)).not.toContain('auth.login');
  });

  it('alerts: severity, the employee, count and status; Acknowledge asks a contextual confirmation, then refreshes the counts', async () => {
    const fixture = TestBed.createComponent(SecurityCenterPage);
    const root = await settle(fixture);
    expect(api.alerts).toHaveBeenCalledWith(expect.objectContaining({ status: 'new,acknowledged', page: 1, pageSize: 20 }));
    const row = testId(root, 'alert-row')!;
    expect(text(row)).toContain('securityCenter.severity.high');
    expect(text(row)).toContain('Repeated failed sign-in attempts');
    expect(text(row)).toContain('Ahmed Mohamed');
    expect(text(row)).toContain('securityCenter.alerts.statuses.new');
    const overviewCalls = api.overview.mock.calls.length;
    testId(row, 'alert-acknowledge')!.click();
    await settle(fixture);
    expect(confirm.mock.calls[0]![0]).toMatchObject({ heading: 'securityCenter.alerts.confirm.acknowledgeTitle', confirmLabel: 'securityCenter.alerts.acknowledge' });
    expect(api.acknowledge).toHaveBeenCalledWith('al1');
    expect(api.overview.mock.calls.length).toBeGreaterThan(overviewCalls);
  });

  it('a status filter goes back to page 1 and asks the API for that status', async () => {
    const fixture = TestBed.createComponent(SecurityCenterPage);
    const root = await settle(fixture);
    testId(root, 'alerts-view-resolved')!.click();
    await settle(fixture);
    expect(api.alerts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'resolved', page: 1 }));
  });

  it('system health: the overall status, one card per real component with its state; Details and Refresh (a fresh check)', async () => {
    const fixture = TestBed.createComponent(SecurityCenterPage);
    const root = await settle(fixture);
    expect(text(testId(root, 'system-health-overall'))).toContain('securityCenter.health.overall.degraded');
    for (const key of ['api', 'database', 'redis', 'queues', 'storage', 'email']) expect(testId(root, `health-${key}`), key).not.toBeNull();
    expect(text(testId(root, 'health-database'))).toContain('securityCenter.health.latency');
    expect(text(testId(root, 'health-queues'))).toContain('securityCenter.health.status.degraded');
    expect(text(testId(root, 'health-queues'))).toContain('17');
    [...testId(root, 'health-queues')!.querySelectorAll('button')].find((button) => button.textContent?.includes('securityCenter.health.details'))!.click();
    await settle(fixture);
    expect(text(testId(root, 'health-details'))).toContain('securityCenter.health.lastChecked');
    testId(root, 'system-health-refresh')!.click();
    await settle(fixture);
    expect(api.health).toHaveBeenLastCalledWith(true);
  });

  it('the alert page: details, findings with device and audit link, Resolve asks first', async () => {
    const fixture = TestBed.createComponent(SecurityAlertPage);
    fixture.componentRef.setInput('id', 'al1');
    const root = await settle(fixture);
    expect(text(testId(root, 'alert-title'))).toContain('Repeated failed sign-in attempts');
    expect(text(testId(root, 'alert-employee'))).toContain('Ahmed Mohamed');
    expect(text(testId(root, 'alert-events'))).toContain('Chrome');
    testId(root, 'alert-resolve')!.click();
    await settle(fixture);
    expect(confirm.mock.calls[0]![0]).toMatchObject({ heading: 'securityCenter.alerts.confirm.resolveTitle', variant: 'warning' });
    expect(api.resolve).toHaveBeenCalledWith('al1');
  });
});

describe('Security Center access', () => {
  it('the routes need the Super Administrator’s security permission — nobody else can open them', () => {
    expect(ADMIN_ROUTES.find((route) => route.path === 'security')!.data?.['permission']).toBe('audit.view_security');
    expect(ADMIN_ROUTES.find((route) => route.path === 'security/alerts/:id')!.data?.['permission']).toBe('audit.view_security');
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    for (const [role, open] of [['system_administrator', true], ['ceo', false], ['sales_manager', false], ['sales_representative', false]] as Array<[RoleKey, boolean]>) {
      signInAs(role);
      expect(TestBed.inject(NavigationService).canOpen('/admin/security'), role).toBe(open);
      expect(TestBed.inject(NavigationService).canOpen('/admin/security/alerts/x'), role).toBe(open);
    }
    expect(TestBed.inject(Router)).toBeDefined();
  });
});
