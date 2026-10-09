import { Service, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import type { SiteWrite } from '../models/site-write.interface';
import type { Site } from '../models/site.interface';

/** Typed client for the customer sites endpoints (SITE-01..05). */
@Service()
export class SitesApi {
  private readonly api = inject(ApiService);

  list(customerId: string): Observable<Site[]> {
    return this.api.get<Site[]>(`customers/${customerId}/sites`);
  }

  get(id: string): Observable<Site> {
    return this.api.get<{ site: Site }>(`sites/${id}`).pipe(map((body) => body.site));
  }

  create(customerId: string, body: SiteWrite): Observable<Site> {
    return this.api.post<Site>(`customers/${customerId}/sites`, body);
  }

  update(id: string, body: Partial<SiteWrite>): Observable<Site> {
    return this.api.patch<Site>(`sites/${id}`, body);
  }
}
