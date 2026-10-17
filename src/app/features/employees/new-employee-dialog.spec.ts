import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { of } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { routes } from '../../app.routes';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { AdminApi, type AdminUser } from '../admin/admin-api.service';
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
/** Buttons whose text is exactly `label` (tests render translation keys). */
const button = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
const field = (root: HTMLElement, id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
function type(root: HTMLElement, id: string, value: string): void {
  const input = field(root, id);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
/** Everything the browser could persist a draft in. */
const persisted = () => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie });

describe('New Employee dialog: Save creates, Cancel discards — no drafts', () => {
  let api: { createUser: ReturnType<typeof vi.fn> } & Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<EmployeesPage>;
  let root: HTMLElement;

  beforeEach(async () => {
    api = {
      users: vi.fn(() => of({ rows: [] as AdminUser[], total: 0, page: 1, pageSize: 25, pageCount: 0 })),
      roles: vi.fn(() => of([{ code: 'sales_representative', nameAr: 'مندوب', nameEn: 'Sales Representative' }])),
      teams: vi.fn(() => of([])),
      openWork: vi.fn(() => of([])),
      createUser: vi.fn(() => of({ user: { id: 'new-id' } })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApi, useValue: api },
        { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true), pending: signal(null) } },
      ],
    });
    signInAs('system_administrator');
    fixture = TestBed.createComponent(EmployeesPage);
    root = await settle(fixture);
  });

  // Reference data and the manager picker read from the API; nothing may ever be written to it except by Save.
  afterEach(() => expect(TestBed.inject(HttpTestingController).match((request) => request.method !== 'GET')).toEqual([]));

  const open = async () => {
    button(root, 'admin.users.new')!.click();
    return settle(fixture);
  };
  const dialogOpen = () => !!root.querySelector('#u-email');

  it('Save and a red Cancel share one row that spans the whole dialog', async () => {
    await open();
    const row = root.querySelector('[data-testid="employee-editor-actions"]')!;
    const [save, cancel] = [...row.querySelectorAll('button')];
    expect(row.className).toContain('grid-cols-2');
    expect(row.className).toContain('sm:col-span-2');
    expect(save!.textContent!.trim()).toBe('crm.common.save');
    expect(cancel!.textContent!.trim()).toBe('crm.common.cancel');
    for (const b of [save!, cancel!]) expect(b.className).toContain('w-full');
    // The design system's danger colour, with its own hover and focus ring.
    expect(cancel!.className).toContain('bg-destructive');
    expect(cancel!.className).toContain('focus-visible:ring-2');
    expect(cancel!.type).toBe('button');
  });

  it('1. open → Cancel without typing anything: nothing is created, sent or stored', async () => {
    const before = persisted();
    await open();
    button(root, 'crm.common.cancel')!.click();
    await settle(fixture);
    expect(dialogOpen()).toBe(false);
    expect(api.createUser).not.toHaveBeenCalled();
    expect(persisted()).toBe(before);
  });

  it('2. open → partial input → Cancel → reopen: a completely fresh form, and nothing was persisted on the way', async () => {
    const before = persisted();
    await open();
    type(root, 'u-email', 'half@ecotech.test');
    type(root, 'u-name-en', 'Half Typed');
    type(root, 'u-password', 'secret1');
    type(root, 'u-password-confirm', 'secret1');
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await settle(fixture);
    expect(persisted()).toBe(before);
    button(root, 'crm.common.cancel')!.click();
    await settle(fixture);
    expect(api.createUser).not.toHaveBeenCalled();
    expect(persisted()).toBe(before);

    await open();
    for (const id of ['u-email', 'u-name-en', 'u-password', 'u-password-confirm']) expect(field(root, id).value, id).toBe('');
    expect(root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  });

  it('closing with ✕ also discards what was typed', async () => {
    await open();
    type(root, 'u-email', 'gone@ecotech.test');
    const typedInto = field(root, 'u-email');
    root.querySelector<HTMLButtonElement>('dialog button[aria-label]')!.click();
    await settle(fixture);
    expect(dialogOpen()).toBe(false);
    await open();
    // A new form, not the old one re-shown.
    expect(field(root, 'u-email')).not.toBe(typedInto);
    expect(field(root, 'u-email').value).toBe('');
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it('3. open → valid input → Save: the only path that creates the employee (once), then a fresh form next time', async () => {
    await open();
    type(root, 'u-email', 'new.hire@ecotech.test');
    type(root, 'u-name-ar', 'موظف جديد');
    type(root, 'u-name-en', 'New Hire');
    type(root, 'u-password', 'welcome1');
    type(root, 'u-password-confirm', 'welcome1');
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await settle(fixture);
    const save = button(root, 'crm.common.save')!;
    expect(save.disabled).toBe(false);
    save.click();
    await settle(fixture);
    expect(api.createUser).toHaveBeenCalledTimes(1);
    expect(api.createUser.mock.calls[0]![0]).toMatchObject({ email: 'new.hire@ecotech.test', fullNameEn: 'New Hire', roleCodes: ['sales_representative'], password: 'welcome1', confirmPassword: 'welcome1' });
    expect(dialogOpen()).toBe(false);
    await open();
    expect(field(root, 'u-email').value).toBe('');
    expect(field(root, 'u-password').value).toBe('');
  });

  it('4. invalid input: the existing validation still holds — Save stays disabled and says why', async () => {
    await open();
    expect(button(root, 'crm.common.save')!.disabled).toBe(true);
    type(root, 'u-email', 'person@ecotech.test');
    type(root, 'u-name-ar', 'شخص');
    type(root, 'u-name-en', 'Person');
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    type(root, 'u-password', '123456');
    await settle(fixture);
    expect(root.textContent).toContain('validation.passwordLetterRequired');
    type(root, 'u-password', 'abcdef1');
    type(root, 'u-password-confirm', 'abcdef2');
    await settle(fixture);
    expect(root.querySelector('#u-password-mismatch')).not.toBeNull();
    expect(button(root, 'crm.common.save')!.disabled).toBe(true);
    expect(api.createUser).not.toHaveBeenCalled();
  });
});
