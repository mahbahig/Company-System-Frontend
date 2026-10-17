import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import type { RoleKey } from '../../../testing/role-permissions';
import { routes } from '../../app.routes';
import { ConfirmService, type ConfirmRequest } from '../../shared/ui/confirm/confirm.service';
import { SupportTicketDetailPage } from './detail/support-ticket-detail.page';
import type { SupportTicketDetail } from './models/support-ticket-detail.interface';
import type { SupportTicket, SupportTicketStatus } from './models/support-ticket.interface';
import { DEFAULT_ATTACHMENT_POLICY } from './shared/screenshot-checks';
import { SUPPORT_STATUS_TONE, SUPPORT_STATUSES } from './shared/support-display';
import { SupportApi } from './support-api.service';

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
const button = (root: Element, label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

const ticket = (status: SupportTicketStatus): SupportTicket => ({
  id: 't1',
  ticketNo: 'TK-1042',
  title: 'Export broken',
  description: 'Nothing happens',
  category: 'bug',
  status,
  severity: 'medium',
  requesterId: 'u-sales_representative',
  requesterNameAr: 'أحمد حسن',
  requesterNameEn: 'Ahmed Hassan',
  requesterEmail: 'ahmed@example.com',
  lastActivityAt: '2026-10-17T12:00:00Z',
  commentCount: 0,
  attachmentCount: 0,
  createdAt: '2026-10-17T07:30:00Z',
  updatedAt: '2026-10-17T12:00:00Z',
  reopenCount: 1,
  history: [
    { from: null, to: 'pending', at: '2026-10-17T07:30:00Z', byId: 'u1', byNameEn: 'Ahmed Hassan', byNameAr: 'أحمد حسن', byRole: 'requester' },
    { from: 'pending', to: 'resolved', at: '2026-10-17T09:00:00Z', byId: 'a1', byNameEn: 'Mahmoud Ahmed', byNameAr: 'محمود أحمد', byRole: 'support' },
    { from: 'resolved', to: 'reopened', at: '2026-10-17T11:32:00Z', byId: 'u1', byNameEn: 'Ahmed Hassan', byNameAr: 'أحمد حسن', byRole: 'requester' },
  ],
});

async function render(role: RoleKey, status: SupportTicketStatus, permissions: Partial<SupportTicketDetail['permissions']>) {
  const requests: ConfirmRequest[] = [];
  const confirm = vi.fn(async (request: ConfirmRequest) => {
    requests.push(request);
    const result = request.action?.();
    if (result && typeof (result as Observable<unknown>).subscribe === 'function') await firstValueFrom(result as Observable<unknown>);
    return true;
  });
  const detail: SupportTicketDetail = {
    ticket: ticket(status),
    comments: [],
    attachments: [],
    permissions: { canComment: false, canChangeStatus: false, nextStatuses: [], canReopen: false, canDelete: false, canDeleteAttachments: false, ...permissions },
  };
  const api = {
    attachmentPolicy: () => of(DEFAULT_ATTACHMENT_POLICY),
    attachmentUrl: () => '/img',
    get: vi.fn(() => of(detail)),
    reopen: vi.fn(() => of(ticket('reopened'))),
    changeStatus: vi.fn((_id: string, next: SupportTicketStatus) => of(ticket(next))),
    create: vi.fn(),
    remove: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SupportApi, useValue: api },
      { provide: ConfirmService, useValue: { confirm, pending: signal(null), running: signal(false), failure: signal(null) } },
    ],
  });
  signInAs(role);
  const fixture = TestBed.createComponent(SupportTicketDetailPage);
  fixture.componentRef.setInput('id', 't1');
  return { root: await settle(fixture), fixture, api, requests };
}

describe('Support ticket lifecycle in the UI', () => {
  it('resolved and closed never look alike; every status has its own colour', () => {
    expect(SUPPORT_STATUSES).toEqual(['pending', 'reopened', 'resolved', 'closed']);
    expect(new Set(SUPPORT_STATUSES.map((status) => SUPPORT_STATUS_TONE[status])).size).toBe(4);
    expect(SUPPORT_STATUS_TONE.resolved).not.toBe(SUPPORT_STATUS_TONE.closed);
  });

  it('a resolved ticket: the employee reads that they may reopen it, and Reopen Ticket reopens THE SAME ticket after a confirmation', async () => {
    const { root, fixture, api, requests } = await render('sales_representative', 'resolved', { canComment: true, canReopen: true });
    const banner = root.querySelector('[data-testid="ticket-resolved-banner"]')!;
    expect(text(banner)).toContain('support.lifecycle.resolvedBody');
    const reason = root.querySelector<HTMLTextAreaElement>('#ticket-reopen-reason')!;
    reason.value = 'Still broken';
    reason.dispatchEvent(new Event('input'));
    button(banner, 'support.actions.reopenTicket')!.click();
    await settle(fixture);
    expect(requests[0]).toMatchObject({ heading: 'support.confirm.reopenTicketTitle', confirmLabel: 'support.actions.reopenTicket', variant: 'default' });
    expect(api.reopen).toHaveBeenCalledWith('t1', 'Still broken');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('a closed ticket: "permanently closed and cannot be reopened" — no Reopen, no reply box, no other way back', async () => {
    const { root } = await render('sales_representative', 'closed', {});
    expect(text(root.querySelector('[data-testid="ticket-closed-banner"]')!)).toContain('support.lifecycle.closedBody');
    expect(button(root, 'support.actions.reopenTicket')).toBeUndefined();
    expect(root.querySelector('#ticket-reply')).toBeNull();
    expect(root.querySelector('[data-testid="ticket-status"] svg')).not.toBeNull();
  });

  it('the desk: Resolve Ticket and Close Ticket Permanently are separate, each explaining what it means', async () => {
    const { root } = await render('system_administrator', 'pending', { canComment: true, canChangeStatus: true, nextStatuses: ['resolved', 'closed'] });
    expect(root.querySelector('[data-testid="ticket-resolve"]')!.textContent).toContain('support.actions.resolveTicket');
    expect(root.querySelector('[data-testid="ticket-close"]')!.textContent).toContain('support.actions.closePermanently');
    expect(text(root)).toContain('support.lifecycle.resolveHint');
    expect(text(root)).toContain('support.lifecycle.closeHint');
  });

  it('closing asks a danger, irreversible confirmation named "Close Ticket Permanently", then the API closes it', async () => {
    const { root, fixture, api, requests } = await render('system_administrator', 'resolved', { canComment: true, canChangeStatus: true, nextStatuses: ['closed'] });
    expect(root.querySelector('[data-testid="ticket-resolve"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[data-testid="ticket-close"]')!.click();
    await settle(fixture);
    expect(requests[0]).toMatchObject({ heading: 'support.confirm.closeTicketTitle', confirmLabel: 'support.actions.closePermanently', variant: 'danger', irreversible: true });
    expect(requests[0]!.details).toEqual(['support.confirm.closeTicketKept']);
    expect(api.changeStatus).toHaveBeenCalledWith('t1', 'closed', '');
  });

  it('resolving is a lighter confirmation (default variant), not a destructive one', async () => {
    const { root, fixture, requests, api } = await render('system_administrator', 'reopened', { canComment: true, canChangeStatus: true, nextStatuses: ['resolved', 'closed'] });
    root.querySelector<HTMLButtonElement>('[data-testid="ticket-resolve"]')!.click();
    await settle(fixture);
    expect(requests[0]).toMatchObject({ confirmLabel: 'support.actions.resolveTicket', variant: 'default' });
    expect(requests[0]!.irreversible).toBeFalsy();
    expect(api.changeStatus).toHaveBeenCalledWith('t1', 'resolved', '');
  });

  it('a closed ticket offers the desk nothing to change', async () => {
    const { root } = await render('system_administrator', 'closed', { canChangeStatus: false, nextStatuses: [] });
    expect(root.querySelector('[data-testid="ticket-resolve"]')).toBeNull();
    expect(root.querySelector('[data-testid="ticket-close"]')).toBeNull();
  });

  it('the ticket’s history lists every step with who and when (12-hour clock)', async () => {
    const { root } = await render('sales_representative', 'reopened', { canComment: true });
    const steps = [...root.querySelectorAll('[data-testid="ticket-history"] li')];
    expect(steps.map((step) => step.querySelector('p')!.textContent!.trim())).toEqual(['support.history.created', 'support.history.resolved', 'support.history.reopened']);
    for (const step of steps) expect(step.querySelector('time')!.textContent).toMatch(/\d{1,2}:\d{2}\s?(AM|PM|ص|م)/);
  });
});
