import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../environments/environment';
import { userWithRoles } from '../../testing/as-role';
import { AuthService } from '../core/auth/auth.service';
import { EvidenceSelectComponent } from '../shared/crm/evidence-select/evidence-select.component';
import { LeadsDistributePage } from './leads/distribute/leads-distribute.page';
import { LeadsApi } from './leads/leads-api.service';
import { TaskFormPage } from './tasks/form/task-form.page';
import { TasksApi } from './tasks/tasks-api.service';

const API = environment.apiBaseUrl;
const tick = () => new Promise((resolve) => setTimeout(resolve));
const EMPTY_PAGE = { rows: [], total: 0, page: 1, pageSize: 20, pageCount: 0 };

@Component({ template: '' })
class Blank {}

/** Every existing record a form refers to is chosen from what the server lists — never typed as an id. */
describe('Entity fields are selects fed by the API, never free text', () => {
  function configure(role: Parameters<typeof userWithRoles>[0], providers: unknown[] = []) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }]), provideHttpClient(), provideHttpClientTesting(), ...(providers as never[])],
    });
    TestBed.inject(AuthService).user.set(userWithRoles(role));
    return TestBed.inject(HttpTestingController);
  }

  it('task assignee: a select of active users (GET /users/lookup); the chosen id is what is sent', async () => {
    const create = vi.fn(() => of({ id: 't-1' }));
    const http = configure('sales_manager', [{ provide: TasksApi, useValue: { create, update: vi.fn() } }]);
    const fixture = TestBed.createComponent(TaskFormPage);
    fixture.detectChanges();
    await tick();
    http.expectOne((request) => request.url === `${API}/users/lookup`).flush({ success: true, data: [{ id: 'u-rep', fullNameAr: 'مندوب', fullNameEn: 'Rep One' }] });
    await tick();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const assignee = root.querySelector('#assignee')!;
    expect(assignee.tagName).toBe('SELECT');
    expect([...(assignee as HTMLSelectElement).options].map((option) => option.value)).toEqual(['', 'u-rep']);
    (assignee as HTMLSelectElement).value = 'u-rep';
    assignee.dispatchEvent(new Event('change'));
    const title = root.querySelector<HTMLInputElement>('#title')!;
    title.value = 'Call the site manager';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    await tick();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Call the site manager', assigneeId: 'u-rep' }));
  });

  it('lead distribution: the owner is a select limited to Sales Representatives and Telesales (the API checks scope)', async () => {
    const http = configure('sales_manager', [{ provide: LeadsApi, useValue: { bank: vi.fn(() => of(EMPTY_PAGE)), assign: vi.fn(), preview: vi.fn(), distribute: vi.fn() } }]);
    const fixture = TestBed.createComponent(LeadsDistributePage);
    fixture.detectChanges();
    await tick();
    const lookup = http.expectOne((request) => request.url === `${API}/users/lookup`);
    expect(lookup.request.params.get('role')).toBe('sales_representative,telesales');
    lookup.flush({ success: true, data: [] });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#dm-owner')!.tagName).toBe('SELECT');
  });

  it('combined proposal PDF: chosen among the proposal\'s own PDF documents (no id to type)', async () => {
    const http = configure('project_manager');
    const fixture = TestBed.createComponent(EvidenceSelectComponent);
    fixture.componentRef.setInput('entityType', 'combined_proposal');
    fixture.componentRef.setInput('entityId', 'cp-1');
    fixture.componentRef.setInput('inputId', 'cp-attach');
    fixture.componentRef.setInput('mimeTypes', ['application/pdf']);
    fixture.detectChanges();
    await tick();
    const list = http.expectOne((request) => request.url === `${API}/documents`);
    expect(list.request.params.get('entityType')).toBe('combined_proposal');
    expect(list.request.params.get('entityId')).toBe('cp-1');
    list.flush({
      ...EMPTY_PAGE,
      rows: [
        { id: 'd-pdf', fileName: 'proposal.pdf', category: 'proposal', mimeType: 'application/pdf', version: 1, isCurrent: true },
        { id: 'd-png', fileName: 'photo.png', category: 'proposal', mimeType: 'image/png', version: 1, isCurrent: true },
        { id: 'd-old', fileName: 'old.pdf', category: 'proposal', mimeType: 'application/pdf', version: 1, isCurrent: false },
      ],
    });
    await tick();
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#cp-attach')!;
    expect([...select.options].map((option) => option.value)).toEqual(['', 'd-pdf']);
  });
});
