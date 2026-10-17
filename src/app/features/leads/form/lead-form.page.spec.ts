import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { userWithRoles } from '../../../../testing/as-role';
import { AuthService } from '../../../core/auth/auth.service';
import { LeadsApi } from '../leads-api.service';
import { LeadFormPage } from './lead-form.page';

const tick = () => new Promise((resolve) => setTimeout(resolve));

@Component({ template: '' })
class Blank {}

const STORED_LEAD = {
  id: 'lead-1',
  leadNo: 'LEAD-1',
  name: 'Delta Foods',
  phone: '01012345678',
  sourceCode: 'website',
  priority: 'normal',
  status: 'qualifying',
  qualification: { budget: 2_500_000, useCase: 'Reduce factory bills' },
};

describe('Lead form: Create Lead has no qualification; editing keeps it', () => {
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* no storage in this environment */
    }
    create = vi.fn(() => of({ id: 'lead-new' }));
    update = vi.fn(() => of({ id: 'lead-1' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'leads/:id', component: Blank }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LeadsApi, useValue: { create, update, get: () => of({ lead: STORED_LEAD, canEdit: true }) } },
      ],
    });
    TestBed.inject(AuthService).user.set(userWithRoles('telesales'));
  });

  async function render(id?: string) {
    const fixture = TestBed.createComponent(LeadFormPage);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance as unknown as { model: { update(fn: (value: Record<string, unknown>) => Record<string, unknown>): void } };
    const fill = () => {
      page.model.update((value) => ({ ...value, name: 'Nile Bakery', phone: '01012345678', sourceCode: 'website' }));
      fixture.detectChanges();
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await tick();
      await tick();
    };
    return { root, page, fill, submit, fixture };
  }

  it('create: no qualification section and no qualification inputs', async () => {
    const view = await render();
    expect(view.root.querySelector('#qualification-heading')).toBeNull();
    expect(view.root.querySelector('#lead-qualification-fields')).toBeNull();
    expect(view.root.querySelector('[id^="lq-"]')).toBeNull();
  });

  it('create: the payload carries no qualification, even with values left in the model (e.g. an old draft)', async () => {
    const view = await render();
    view.fill();
    view.page.model.update((value) => ({ ...value, q: { ...(value['q'] as object), budget: -5, interestLevel: 9, useCase: 'old draft' } }));
    view.fixture.detectChanges();
    await view.submit();
    // Out-of-range qualification values do not block a create: there is no qualification validation here.
    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Nile Bakery', sourceCode: 'website' });
    expect('qualification' in body).toBe(false);
  });

  it('edit: the qualification section is there, filled from the lead, and sent with the update', async () => {
    const view = await render('lead-1');
    expect(view.root.querySelector('#qualification-heading')).not.toBeNull();
    expect(view.root.querySelector<HTMLInputElement>('#lq-budget')!.value).toBe('2500000');
    await view.submit();
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0]![1] as Record<string, unknown>)['qualification']).toMatchObject({ budget: 2_500_000, useCase: 'Reduce factory bills' });
  });
});
