import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding, type ActivatedRouteSnapshot, type RouterStateSnapshot, type UrlTree } from '@angular/router';
import { firstValueFrom, of, Subject } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import type { RoleKey } from '../../../testing/role-permissions';
import { routes } from '../../app.routes';
import { ApiService } from '../../core/api/api.service';
import type { UploadProgress } from '../../core/api/upload-progress.interface';
import { SidebarNavComponent } from '../../core/layout/sidebar-nav/sidebar-nav.component';
import { NavigationService } from '../../core/navigation/navigation.service';
import { SupportTicketDetailPage } from './detail/support-ticket-detail.page';
import { SupportTicketFormPage } from './form/support-ticket-form.page';
import { DELETE_ALL_PHRASE, SupportTicketsAdminPage } from './manage/support-tickets-admin.page';
import type { SupportTicketDetail } from './models/support-ticket-detail.interface';
import type { SupportTicket } from './models/support-ticket.interface';
import { DEFAULT_ATTACHMENT_POLICY, screenshotProblem } from './shared/screenshot-checks';
import { SupportApi } from './support-api.service';
import { notSupportDeskGuard } from './support-desk.guard';
import { SUPPORT_ROUTES } from './support.routes';

const tick = () => new Promise((resolve) => setTimeout(resolve));
async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await tick();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
const text = (root: HTMLElement) => root.textContent ?? '';
const buttons = (root: HTMLElement) => [...root.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? '');

const TICKET: SupportTicket = {
  id: 't1',
  ticketNo: 'TKT-2026-000001',
  title: 'Upload fails',
  description: 'The dialog closes',
  category: 'bug',
  status: 'pending',
  severity: 'critical',
  requesterId: 'u1',
  requesterNameAr: 'أحمد',
  requesterNameEn: 'Ahmed Mohamed',
  requesterEmail: 'ahmed@example.com',
  lastActivityAt: '2026-10-16T10:00:00Z',
  commentCount: 1,
  attachmentCount: 1,
  createdAt: '2026-10-16T09:00:00Z',
  updatedAt: '2026-10-16T10:00:00Z',
};

function detailWith(permissions: SupportTicketDetail['permissions']): SupportTicketDetail {
  return {
    ticket: TICKET,
    comments: [{ id: 'c1', ticketId: 't1', authorId: { id: 'admin', fullNameAr: 'مدير', fullNameEn: 'Admin' }, authorRole: 'support', body: 'Which browser?', createdAt: '2026-10-16T09:30:00Z' }],
    attachments: [{ id: 'a1', fileName: 'shot.png', contentType: 'image/png', bytes: 2048, width: 10, height: 10, expiresAt: Date.now() + 60_000, signature: 'ab' }],
    permissions,
  };
}

function configure(api: Partial<SupportApi> = {}): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SupportApi, useValue: { attachmentPolicy: () => of(DEFAULT_ATTACHMENT_POLICY), attachmentUrl: () => '/img', ...api } },
    ],
  });
}

describe('Help & Support', () => {
  describe('navigation: every employee finds Help & Support; only the System Administrator gets the desk, and files nothing', () => {
    async function navFor(role: RoleKey): Promise<string[]> {
      TestBed.resetTestingModule();
      configure();
      signInAs(role);
      const root = await settle(TestBed.createComponent(SidebarNavComponent));
      return [...root.querySelectorAll('a[href]')].map((anchor) => (anchor.getAttribute('href') ?? '').replace(/^\/(ar|en)/, ''));
    }

    it('every role sees Help & Support — except the System Administrator, who answers the tickets', async () => {
      for (const role of ['installation_crew', 'sales_representative', 'read_only_executive', 'ceo', 'sales_manager'] as RoleKey[]) expect(await navFor(role)).toContain('/support');
      expect(await navFor('system_administrator')).not.toContain('/support');
    });

    it('only the System Administrator sees Support tickets — not the CEO or a manager', async () => {
      expect(await navFor('system_administrator')).toContain('/admin/support-tickets');
      for (const role of ['ceo', 'sales_manager', 'technical_lead'] as RoleKey[]) expect(await navFor(role)).not.toContain('/admin/support-tickets');
    });

    it('typed URLs follow the same rule', () => {
      configure();
      signInAs('sales_representative');
      const navigation = TestBed.inject(NavigationService);
      expect(navigation.canOpen('/support')).toBe(true);
      expect(navigation.canOpen('/support/new')).toBe(true);
      expect(navigation.canOpen('/admin/support-tickets')).toBe(false);
    });

    it('the support desk opening the form or its own list is sent to the desk list; a ticket still opens', () => {
      expect(SUPPORT_ROUTES.filter((route) => route.canActivate?.includes(notSupportDeskGuard)).map((route) => route.path)).toEqual(['', 'new']);
      const guard = () =>
        TestBed.runInInjectionContext(() => notSupportDeskGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
      configure();
      signInAs('system_administrator');
      expect(TestBed.inject(Router).serializeUrl(guard() as UrlTree)).toBe('/admin/support-tickets');
      signInAs('ceo');
      expect(guard()).toBe(true);
    });
  });

  describe('client-side screenshot checks (the API checks again by content)', () => {
    const file = (name: string, type: string, size = 100) => ({ name, type, size });
    it('accepts PNG, JPG and WebP, refuses other types, empty and oversized files', () => {
      expect(screenshotProblem(file('a.png', 'image/png'), DEFAULT_ATTACHMENT_POLICY)).toBeNull();
      expect(screenshotProblem(file('a.JPEG', 'image/jpeg'), DEFAULT_ATTACHMENT_POLICY)).toBeNull();
      expect(screenshotProblem(file('a.webp', 'image/webp'), DEFAULT_ATTACHMENT_POLICY)).toBeNull();
      expect(screenshotProblem(file('a.gif', 'image/gif'), DEFAULT_ATTACHMENT_POLICY)).toBe('wrongType');
      expect(screenshotProblem(file('a.png', 'application/octet-stream'), DEFAULT_ATTACHMENT_POLICY)).toBe('wrongType');
      expect(screenshotProblem(file('a.exe', 'image/png'), DEFAULT_ATTACHMENT_POLICY)).toBe('wrongType');
      expect(screenshotProblem(file('a.png', 'image/png', 0), DEFAULT_ATTACHMENT_POLICY)).toBe('empty');
      expect(screenshotProblem(file('a.png', 'image/png', 11 * 1024 * 1024), DEFAULT_ATTACHMENT_POLICY)).toBe('tooLarge');
    });
  });

  describe('new ticket form', () => {
    function png(name: string, size = 1024): File {
      return new File([new Uint8Array(size)], name, { type: 'image/png' });
    }

    it('requires a title and a description before anything is sent', async () => {
      const create = vi.fn();
      configure({ create });
      signInAs('sales_representative');
      const fixture = TestBed.createComponent(SupportTicketFormPage);
      const root = await settle(fixture);
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(create).not.toHaveBeenCalled();
      expect(root.querySelector('#ticket-title-error')).not.toBeNull();
      expect(root.querySelector('#ticket-description-error')).not.toBeNull();
    });

    it('previews chosen screenshots, flags a wrong type, refuses files beyond the limit, and lets one be removed', async () => {
      configure({ create: vi.fn() });
      signInAs('sales_representative');
      const fixture = TestBed.createComponent(SupportTicketFormPage);
      const page = fixture.componentInstance as unknown as { add(files: File[]): void; screenshots(): Array<{ problem: string | null }>; overflow(): boolean; canSubmit(): boolean };
      await settle(fixture);
      page.add([png('a.png'), new File(['x'], 'b.gif', { type: 'image/gif' })]);
      const root = await settle(fixture);
      expect(root.querySelectorAll('ul li').length).toBe(2);
      expect(page.screenshots().map((shot) => shot.problem)).toEqual([null, 'wrongType']);
      page.add([png('c.png'), png('d.png'), png('e.png'), png('f.png')]);
      expect(page.screenshots()).toHaveLength(5);
      expect(page.overflow()).toBe(true);
      const removeButtons = [...root.querySelectorAll<HTMLButtonElement>('ul li button')];
      removeButtons[1].click();
      await settle(fixture);
      expect(page.screenshots().every((shot) => shot.problem === null)).toBe(true);
    });

    it('submits the ticket with its screenshots once, shows progress, then opens the new ticket', async () => {
      const progress = new Subject<UploadProgress<SupportTicket>>();
      const create = vi.fn(() => progress.asObservable());
      configure({ create });
      signInAs('sales_representative');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(SupportTicketFormPage);
      const page = fixture.componentInstance as unknown as { add(files: File[]): void; set(key: string, value: string): void; busy(): boolean };
      await settle(fixture);
      page.set('title', '  Upload fails  ');
      page.set('description', 'The dialog closes');
      page.add([png('shot.png')]);
      const root = await settle(fixture);
      const form = root.querySelector('form')!;
      form.dispatchEvent(new Event('submit'));
      form.dispatchEvent(new Event('submit')); // a double click sends nothing more
      expect(create).toHaveBeenCalledTimes(1);
      // No severity chosen: the ticket goes as medium (the API's default too).
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload fails', severity: 'medium', screenshots: [expect.any(File)] }));
      progress.next({ progress: 0.4 });
      await settle(fixture);
      expect(root.querySelector<HTMLElement>('[role=status] .bg-primary')?.style.width).toBe('40%');
      expect(root.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
      progress.next({ progress: 1, result: TICKET });
      progress.complete();
      expect(navigate).toHaveBeenCalledWith(['/', 'support', 't1'], { state: { supportNotice: 'support.notices.created' } });
      expect(page.busy()).toBe(false);
    });
  });

  describe('ticket detail: the controls follow the API’s permission flags', () => {
    async function render(permissions: SupportTicketDetail['permissions']) {
      TestBed.resetTestingModule();
      configure({ get: () => of(detailWith(permissions)) });
      signInAs('sales_representative');
      const fixture = TestBed.createComponent(SupportTicketDetailPage);
      fixture.componentRef.setInput('id', 't1');
      return settle(fixture);
    }

    it('the employee who filed it reads the conversation and replies — no management controls', async () => {
      const root = await render({ canComment: true, canChangeStatus: false, nextStatuses: [], canDelete: false, canReopen: false, canDeleteAttachments: false });
      expect(text(root)).toContain('Which browser?');
      expect(text(root)).toContain('ahmed@example.com');
      expect(root.querySelector('#ticket-reply')).not.toBeNull();
      expect(root.querySelector('#ticket-note')).toBeNull();
      expect(buttons(root).some((label) => /support\.actions\.(resolve|delete)/.test(label))).toBe(false);
      expect(root.querySelector('img')?.getAttribute('src')).toBe('/img');
    });

    it('the support desk gets resolve, delete and per-screenshot delete', async () => {
      const root = await render({ canComment: true, canChangeStatus: true, nextStatuses: ['resolved'], canDelete: true, canReopen: false, canDeleteAttachments: true });
      expect(root.querySelector('#ticket-note')).not.toBeNull();
      const labels = buttons(root).join(' | ');
      expect(labels).toContain('support.actions.resolve');
      expect(labels).toContain('support.actions.delete');
      expect(root.querySelector('[aria-label="support.actions.deleteAttachment"]')).not.toBeNull();
    });
  });

  describe('support desk: deleting everything takes the typed phrase', () => {
    it('the confirm button stays disabled until DELETE ALL is typed, then the API gets that phrase', async () => {
      const removeAll = vi.fn(() => of({ deletedTickets: 3, deletedComments: 2, deletedAttachments: 1 }));
      configure({ all: () => of({ rows: [TICKET], total: 1, page: 1, pageSize: 25, pageCount: 1 }), removeAll });
      signInAs('system_administrator');
      const fixture = TestBed.createComponent(SupportTicketsAdminPage);
      const page = fixture.componentInstance as unknown as { askDeleteAll(): void; typed: { set(value: string): void }; phraseMatches(): boolean; deleteAll(event: Event): Promise<void> };
      await settle(fixture);
      page.askDeleteAll();
      page.typed.set('delete all');
      expect(page.phraseMatches()).toBe(false);
      await page.deleteAll(new Event('submit'));
      expect(removeAll).not.toHaveBeenCalled();
      page.typed.set(DELETE_ALL_PHRASE);
      expect(page.phraseMatches()).toBe(true);
      await page.deleteAll(new Event('submit'));
      expect(removeAll).toHaveBeenCalledWith('DELETE ALL');
    });
  });

  it('SupportApi.create sends the screenshots as multipart and never who files the ticket', async () => {
    const uploadWithProgress = vi.fn((_path: string, _body: FormData) => of({ progress: 1, result: TICKET }));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { uploadWithProgress } }] });
    const api = TestBed.inject(SupportApi);
    await firstValueFrom(api.create({ title: 'T', description: 'D', category: 'bug', severity: 'high', screenshots: [new File(['x'], 'a.png', { type: 'image/png' })] }));
    const [path, body] = uploadWithProgress.mock.calls[0];
    expect(path).toBe('support/tickets');
    expect([...body.keys()].sort()).toEqual(['attachments', 'category', 'description', 'severity', 'title']);
    expect(body.get('severity')).toBe('high');
    expect((body.get('attachments') as File).name).toBe('a.png');
  });
});
