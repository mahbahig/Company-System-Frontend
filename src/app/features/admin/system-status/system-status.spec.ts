import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { signInAs } from '../../../../testing/as-role';
import { routes } from '../../../app.routes';
import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MaintenanceScreenComponent } from '../../../core/maintenance/maintenance-screen.component';
import { maintenanceInterceptor } from '../../../core/maintenance/maintenance.interceptor';
import { MaintenanceService } from '../../../core/maintenance/maintenance.service';
import { ConfirmService, type ConfirmRequest } from '../../../shared/ui/confirm/confirm.service';
import { LoginPage } from '../../auth/login/login.page';
import { AdminApi, type SystemLockState } from '../admin-api.service';
import { SecurityApi, type MaintenanceState, type SystemState } from '../security/security-api.service';
import { SettingsAdminPage } from '../settings/settings-admin.page';
import { SystemStatusCardComponent } from './system-status-card.component';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await tick();
  }
  return fixture.nativeElement as HTMLElement;
}
const testId = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const ADMIN = { id: 'a1', fullNameEn: 'Mahmoud Bahig', fullNameAr: 'محمود بهيج' };
const UNLOCKED: SystemLockState = { locked: false, changedAt: null, changedBy: null };
const LOCKED: SystemLockState = { locked: true, changedAt: '2026-10-17T11:31:00.000Z', changedBy: ADMIN };
const OFF: MaintenanceState = { enabled: false, changedAt: null, changedBy: null };
const ON: MaintenanceState = { enabled: true, changedAt: '2026-10-17T11:40:00.000Z', changedBy: ADMIN };
const state = (lock: SystemLockState, maintenance: MaintenanceState): SystemState => ({ mode: lock.locked ? 'locked' : maintenance.enabled ? 'maintenance' : 'normal', lock, maintenance });

describe('System Status — the system lock and maintenance mode (Super Administrator)', () => {
  let admin: { lockSystem: ReturnType<typeof vi.fn>; unlockSystem: ReturnType<typeof vi.fn> };
  let security: { systemState: ReturnType<typeof vi.fn>; enableMaintenance: ReturnType<typeof vi.fn>; disableMaintenance: ReturnType<typeof vi.fn> };
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    admin = { lockSystem: vi.fn(() => of(LOCKED)), unlockSystem: vi.fn(() => of({ ...UNLOCKED, changedAt: LOCKED.changedAt, changedBy: ADMIN })) };
    security = { systemState: vi.fn(() => of(state(UNLOCKED, OFF))), enableMaintenance: vi.fn(() => of(ON)), disableMaintenance: vi.fn(() => of({ ...OFF, changedAt: ON.changedAt, changedBy: ADMIN })) };
    // Confirms at once, running the confirmed action first (as the real dialog does).
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
        { provide: AdminApi, useValue: admin },
        { provide: SecurityApi, useValue: security },
        { provide: ConfirmService, useValue: { confirm, pending: signal(null) } },
      ],
    });
  });

  it('normal: "Normal", [Lock System] and [Enable Maintenance Mode]; locking asks a contextual confirmation saying who can still sign in', async () => {
    signInAs('system_administrator');
    const fixture = TestBed.createComponent(SystemStatusCardComponent);
    const root = await settle(fixture);
    expect(testId(root, 'system-mode')!.textContent).toContain('systemStatus.modes.normal');
    const lock = testId(root, 'system-lock-action') as HTMLButtonElement;
    expect(lock.textContent!.trim()).toBe('systemStatus.lock');
    expect(lock.className).toContain('bg-destructive');
    expect(testId(root, 'maintenance-on')!.textContent!.trim()).toBe('systemStatus.maintenanceOn');
    lock.click();
    await settle(fixture);
    const request = confirm.mock.calls[0]![0] as ConfirmRequest;
    expect(request).toMatchObject({ heading: 'systemStatus.confirm.lockTitle', message: 'systemStatus.confirm.lockBody', confirmLabel: 'systemStatus.lock', variant: 'danger' });
    expect(request.details).toContain('systemStatus.confirm.lockSessions');
    expect(admin.lockSystem).toHaveBeenCalledTimes(1);
    expect(testId(root, 'system-mode')!.textContent).toContain('systemStatus.modes.locked');
    expect(testId(root, 'system-unlock')!.textContent!.trim()).toBe('systemStatus.unlock');
    expect(testId(root, 'system-lock-changed')!.textContent).toContain('systemStatus.lockedBy');
  });

  it('maintenance: enabling asks first (warning), then shows "Maintenance Mode"; disabling brings back "Normal"', async () => {
    signInAs('system_administrator');
    const fixture = TestBed.createComponent(SystemStatusCardComponent);
    const root = await settle(fixture);
    testId(root, 'maintenance-on')!.click();
    await settle(fixture);
    expect(confirm.mock.calls[0]![0]).toMatchObject({ heading: 'systemStatus.confirm.maintenanceOnTitle', message: 'systemStatus.confirm.maintenanceOnBody', confirmLabel: 'systemStatus.maintenanceOn', variant: 'warning' });
    expect(security.enableMaintenance).toHaveBeenCalledTimes(1);
    expect(testId(root, 'system-mode')!.textContent).toContain('systemStatus.modes.maintenance');
    expect(testId(root, 'maintenance-changed')!.textContent).toContain('systemStatus.maintenanceOnBy');
    expect(TestBed.inject(MaintenanceService).administratorNotice()).toBe(true);
    testId(root, 'maintenance-off')!.click();
    await settle(fixture);
    expect(security.disableMaintenance).toHaveBeenCalledTimes(1);
    expect(testId(root, 'system-mode')!.textContent).toContain('systemStatus.modes.normal');
  });

  it('locked: cancelling the unlock changes nothing', async () => {
    signInAs('system_administrator');
    security.systemState.mockReturnValue(of(state(LOCKED, OFF)));
    const fixture = TestBed.createComponent(SystemStatusCardComponent);
    const root = await settle(fixture);
    confirm.mockResolvedValueOnce(false);
    testId(root, 'system-unlock')!.click();
    await settle(fixture);
    expect(admin.unlockSystem).not.toHaveBeenCalled();
    expect(testId(root, 'system-mode')!.textContent).toContain('systemStatus.modes.locked');
  });

  it('on the settings page only for the Super Administrator — the CEO never sees it (nor asks the API)', async () => {
    signInAs('ceo');
    const ceo = await settle(TestBed.createComponent(SettingsAdminPage));
    expect(testId(ceo, 'system-status')).toBeNull();
    expect(security.systemState).not.toHaveBeenCalled();
  });
});

describe('Sign-in while the system is locked', () => {
  it('the API’s 403 reads "The system is currently locked" — not "invalid e-mail or password"', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(), provideHttpClientTesting()] });
    vi.spyOn(TestBed.inject(AuthService), 'login').mockRejectedValue(new ApiError(403, { message: 'auth.errors.systemLocked' }));
    // Tests render keys without the catalogues; the page shows an API key only when the catalogue has it (en and ar do: src/i18n/*/system-status.json).
    vi.spyOn(TestBed.inject(I18nService), 'has').mockImplementation((key: string) => key === 'auth.errors.systemLocked');
    const fixture = TestBed.createComponent(LoginPage);
    const root = await settle(fixture);
    for (const [id, value] of [['email', 'rep@ecotech.test'], ['password', 'abcdef1']] as const) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await settle(fixture);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    await settle(fixture);
    expect(root.textContent).toContain('auth.errors.systemLocked');
    expect(root.textContent).not.toContain('auth.errors.invalidCredentials');
  });
});

describe('Maintenance screen', () => {
  const API = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([maintenanceInterceptor])), provideHttpClientTesting()] });
  });

  it('any API answer "maintenance" (503) shows the screen — other errors do not', async () => {
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);
    const maintenance = TestBed.inject(MaintenanceService);
    http.get(`${API}/leads`).subscribe({ error: () => undefined });
    controller.expectOne(`${API}/leads`).flush({ message: 'errors.forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(maintenance.active()).toBe(false);
    http.get(`${API}/leads`).subscribe({ error: () => undefined });
    controller.expectOne(`${API}/leads`).flush({ message: 'errors.maintenance' }, { status: 503, statusText: 'Service Unavailable' });
    expect(maintenance.active()).toBe(true);
  });

  it('the sign-in answer "maintenance" shows it too; the screen is calm (no technical details) and comes back by itself when maintenance ends', async () => {
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);
    const maintenance = TestBed.inject(MaintenanceService);
    http.post(`${API}/auth/login`, {}).subscribe({ error: () => undefined });
    controller.expectOne(`${API}/auth/login`).flush({ message: 'auth.errors.maintenance', statusCode: 503 }, { status: 503, statusText: 'Service Unavailable' });
    expect(maintenance.active()).toBe(true);

    const fixture = TestBed.createComponent(MaintenanceScreenComponent);
    const root = await settle(fixture);
    const screen = testId(root, 'maintenance-screen')!;
    expect(screen.getAttribute('role')).toBe('alertdialog');
    expect(screen.textContent).toContain('maintenance.title');
    expect(screen.textContent).toContain('maintenance.back');
    expect(screen.textContent).toContain('maintenance.later');
    expect(screen.textContent).not.toMatch(/503|error|stack/i);

    const reload = vi.spyOn(maintenance, 'reloadPage').mockImplementation(() => undefined);
    testId(root, 'maintenance-retry')!.click();
    controller.expectOne(`${API}/system/availability`).flush({ success: true, maintenance: true });
    await settle(fixture);
    expect(reload).not.toHaveBeenCalled();
    expect(maintenance.active()).toBe(true);
    testId(root, 'maintenance-retry')!.click();
    controller.expectOne(`${API}/system/availability`).flush({ success: true, maintenance: false });
    await settle(fixture);
    expect(maintenance.active()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
