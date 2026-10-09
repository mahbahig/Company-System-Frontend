import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';
import type { EquipmentItem } from './solar.models';

/** Typed client for the §10 equipment catalog. */
@Service()
export class CatalogApi {
  private readonly api = inject(ApiService);

  list(query: { category?: string; q?: string; includeInactive?: boolean; page?: number; pageSize?: number } = {}): Observable<Page<EquipmentItem>> {
    return this.api.get('catalog/equipment', { pageSize: 200, ...query });
  }

  create(body: Partial<EquipmentItem>): Observable<EquipmentItem> {
    return this.api.post('catalog/equipment', body);
  }

  update(id: string, body: Partial<EquipmentItem>): Observable<EquipmentItem> {
    return this.api.patch(`catalog/equipment/${id}`, body);
  }
}
