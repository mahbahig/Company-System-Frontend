import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { userWithRoles } from '../../../../testing/as-role';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivitiesApi } from '../activities-api.service';
import { CallFormPage } from './call-form.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));

@Component({ template: '' })
class Blank {}

/** The page's own state, read the way its template reads it. */
interface CallFormInternals {
  party(): 'customer' | 'lead' | null;
  customer: { set(value: string): void; (): string };
  lead: { set(value: string): void; (): string };
  opportunity: { set(value: string): void; (): string };
  contact: { set(value: string): void; (): string };
  missing(): string | null;
  set(key: string, value: unknown): void;
}

describe('Log a call: exactly one party, a customer OR a lead', () => {
  let createCall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createCall = vi.fn(() => of({ id: 'call-1' }));
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'calls', component: Blank }]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivitiesApi, useValue: { createCall } }],
    });
    TestBed.inject(AuthService).user.set(userWithRoles('sales_representative'));
  });

  async function render(inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(CallFormPage);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance as unknown as CallFormInternals;
    const save = () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const radio = (party: 'customer' | 'lead') => root.querySelector<HTMLInputElement>(`#call-party-${party}`)!;
    const choose = async (party: 'customer' | 'lead') => {
      radio(party).click();
      fixture.detectChanges();
      await tick();
      fixture.detectChanges();
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await tick();
      fixture.detectChanges();
    };
    const refresh = () => fixture.detectChanges();
    return { root, page, save, radio, choose, submit, refresh };
  }

  it('neither chosen: no picker shown, Save disabled and saying why; nothing is sent', async () => {
    const view = await render();
    view.page.set('outcomeCode', 'interested');
    view.refresh();
    expect(view.page.party()).toBeNull();
    expect(view.radio('customer').checked).toBe(false);
    expect(view.radio('lead').checked).toBe(false);
    expect(view.root.querySelector('#call-customer')).toBeNull();
    expect(view.root.querySelector('#call-lead')).toBeNull();
    expect(view.save().disabled).toBe(true);
    expect(view.page.missing()).toBe('ux.forms.callNeedsParty');
    await view.submit();
    expect(createCall).not.toHaveBeenCalled();
  });

  it('customer chosen: only the customer side is shown and sent (no leadId)', async () => {
    const view = await render();
    await view.choose('customer');
    expect(view.root.querySelector('#call-customer')).not.toBeNull();
    expect(view.root.querySelector('#call-lead')).toBeNull();
    expect(view.page.missing()).toBe('ux.forms.callNeedsCustomer');
    view.page.customer.set('cust-1');
    view.page.opportunity.set('opp-1');
    view.page.set('outcomeCode', 'interested');
    view.refresh();
    expect(view.save().disabled).toBe(false);
    await view.submit();
    const body = createCall.mock.calls[0]![0] as Record<string, unknown>;
    expect(body).toMatchObject({ customerId: 'cust-1', opportunityId: 'opp-1', outcomeCode: 'interested' });
    expect(body['leadId']).toBeUndefined();
  });

  it('lead chosen: only the lead side is shown and sent (no customer, opportunity or contact)', async () => {
    const view = await render();
    await view.choose('lead');
    expect(view.root.querySelector('#call-lead')).not.toBeNull();
    expect(view.root.querySelector('#call-customer')).toBeNull();
    expect(view.root.querySelector('#call-opp')).toBeNull();
    expect(view.page.missing()).toBe('ux.forms.callNeedsLead');
    view.page.lead.set('lead-1');
    view.page.set('outcomeCode', 'interested');
    view.refresh();
    expect(view.save().disabled).toBe(false);
    await view.submit();
    const body = createCall.mock.calls[0]![0] as Record<string, unknown>;
    expect(body['leadId']).toBe('lead-1');
    expect(body['customerId']).toBeUndefined();
    expect(body['opportunityId']).toBeUndefined();
    expect(body['contactId']).toBeUndefined();
  });

  it('both can never be sent: switching the party drops the other side\'s picks', async () => {
    const view = await render();
    await view.choose('customer');
    view.page.customer.set('cust-1');
    view.page.opportunity.set('opp-1');
    view.page.contact.set('contact-1');
    await view.choose('lead');
    expect(view.page.customer()).toBe('');
    expect(view.page.opportunity()).toBe('');
    expect(view.page.contact()).toBe('');
    view.page.lead.set('lead-1');
    await view.choose('customer');
    expect(view.page.lead()).toBe('');
    // Back on the customer side with nothing picked: Save is blocked again.
    expect(view.page.missing()).toBe('ux.forms.callNeedsCustomer');
  });

  it('opened from a record, the party is chosen already', async () => {
    expect((await render({ customerId: 'cust-1' })).page.party()).toBe('customer');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivitiesApi, useValue: { createCall } }],
    });
    const fromLead = await render({ leadId: 'lead-1' });
    expect(fromLead.page.party()).toBe('lead');
    expect(fromLead.radio('lead').checked).toBe(true);
  });
});
