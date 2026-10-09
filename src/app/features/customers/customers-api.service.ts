import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { ContactCreate } from './models/contact-create.interface';
import type { Contact } from './models/contact.interface';
import type { CustomerDetail } from './models/customer-detail.interface';
import type { CustomerListQuery } from './models/customer-list-query.interface';
import type { Customer } from './models/customer.interface';

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

  contacts(customerId: string): Observable<Contact[]> {
    return this.api.get<Contact[]>(`customers/${customerId}/contacts`);
  }

  createContact(customerId: string, body: ContactCreate): Observable<Contact> {
    return this.api.post<Contact>(`customers/${customerId}/contacts`, body);
  }
}
