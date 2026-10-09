import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { SiteRef } from './models/site-ref.interface';

/** Typed client for `GET /customers/:customerId/sites` (site picker on the opportunity form). */
@Service()
export class SitesLookupApi {
  private readonly api = inject(ApiService);

  forCustomer(customerId: string): Observable<SiteRef[]> {
    return this.api.get<SiteRef[]>(`customers/${customerId}/sites`);
  }
}
