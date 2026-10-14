import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { ContactCreate } from './models/contact-create.interface';
import type { Contact } from './models/contact.interface';
import type { CustomerDetail } from './models/customer-detail.interface';
import type { CustomerListQuery } from './models/customer-list-query.interface';
import type { Customer } from './models/customer.interface';
import type { WorkflowView } from '../../shared/crm/pipeline-tracker/workflow-view.interface';

/** Typed client for the customers (and customer contacts) endpoints. */
@Service()
export class CustomersApi {
  private readonly api = inject(ApiService);

  list(query: CustomerListQuery): Observable<Page<Customer>> {
    return this.api.get<Page<Customer>>('customers', { ...query });
  }

  get(id: string): Observable<CustomerDetail> {
    return this.api.get<CustomerDetail>(`customers/${id}`);
  }

  /** `PATCH /customers/:id` — the same update the edit form sends (owner and status have their own endpoints). */
  update(id: string, body: Partial<Pick<Customer, 'email' | 'nextFollowUpAt'>>): Observable<Customer> {
    return this.api.patch<Customer>(`customers/${id}`, body);
  }

  contacts(customerId: string): Observable<Contact[]> {
    return this.api.get<Contact[]>(`customers/${customerId}/contacts`);
  }

  createContact(customerId: string, body: ContactCreate): Observable<Contact> {
    return this.api.post<Contact>(`customers/${customerId}/contacts`, body);
  }

  /** C0–C2 lifecycle tracker. */
  workflow(id: string): Observable<WorkflowView> {
    return this.api.get<WorkflowView>(`customers/${id}/workflow`);
  }

  /** C0 → C1: verified (with the method) or pending with a reason; possible duplicates kept separate explicitly. */
  verify(id: string, body: { state: 'verified' | 'pending'; method?: string; reason?: string; keepSeparate?: boolean }): Observable<Customer> {
    return this.api.post<Customer>(`customers/${id}/verification`, body);
  }

  lifecycle(id: string, body: { action: 'activate_relationship' | 'reopen_enrichment'; reason?: string }): Observable<Customer> {
    return this.api.post<Customer>(`customers/${id}/lifecycle`, body);
  }
}
