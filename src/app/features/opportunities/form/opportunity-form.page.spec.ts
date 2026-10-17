import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { userWithRoles } from '../../../../testing/as-role';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomersApi } from '../../customers/customers-api.service';
import { OpportunitiesApi } from '../opportunities-api.service';
import { SitesLookupApi } from '../sites-lookup-api.service';
import { UsersLookupApi } from '../users-lookup-api.service';
import { OpportunityFormPage } from './opportunity-form.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));

@Component({ template: '' })
class Blank {}

/** Create Opportunity: Solution Type is optional — no required marker, no blocked submit, null when not chosen. */
describe('OpportunityFormPage — Solution Type is optional', () => {
  async function render() {
    const create = vi.fn(() => of({ id: 'o-1' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OpportunitiesApi, useValue: { create, update: vi.fn(), get: vi.fn() } },
        {
          provide: CustomersApi,
          useValue: {
            list: vi.fn(() => of({ rows: [] })),
            contacts: vi.fn(() => of([])),
            get: vi.fn(() => of({ customer: { id: 'c-1', customerNo: 'CUS-1', nameAr: 'عميل', nameEn: 'Customer One' } })),
          },
        },
        { provide: SitesLookupApi, useValue: { forCustomer: vi.fn(() => of([])) } },
        { provide: UsersLookupApi, useValue: { lookup: vi.fn(() => of([])) } },
      ],
    });
    TestBed.inject(AuthService).user.set(userWithRoles('sales_representative'));
    const fixture = TestBed.createComponent(OpportunityFormPage);
    fixture.componentRef.setInput('customerId', 'c-1');
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, create };
  }

  it('shows no required marker on Solution Type', async () => {
    const { root } = await render();
    const label = root.querySelector('label[for="solutionTypeCode"]')!;
    expect(label).not.toBeNull();
    expect(label.hasAttribute('required')).toBe(false);
  });

  it('creates the opportunity without a Solution Type, sending null', async () => {
    const { fixture, root, create } = await render();
    const name = root.querySelector<HTMLInputElement>('#name')!;
    name.value = 'Factory rooftop';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    await tick();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Factory rooftop', customerId: 'c-1', solutionTypeCode: null }));
  });
});
