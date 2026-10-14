import { Service, inject } from '@angular/core';
import { map, of, type Observable } from 'rxjs';

import { ApiService } from '../api/api.service';
import { refKey, type RecordHit, type RecordRef } from './record-ref';

/**
 * Record lookups that always pass through the server's permission and
 * record-scope checks (the same rules as global search):
 * - `search(q)` — scoped full-text search;
 * - `resolve(refs)` — fresh labels for stored references, omitting every
 *   record the caller can no longer open;
 * - favorites — the caller's own pins, re-checked on every read.
 */
@Service()
export class RecordsApi {
  private readonly api = inject(ApiService);

  search(q: string): Observable<RecordHit[]> {
    return this.api.get<{ query: string; hits: RecordHit[] }>('search', { q }).pipe(map((result) => result.hits));
  }

  resolve(refs: readonly RecordRef[]): Observable<RecordHit[]> {
    if (!refs.length) return of([]);
    const unique = [...new Map(refs.map((ref) => [refKey(ref), ref])).values()].slice(0, 50);
    return this.api.get<{ hits: RecordHit[] }>('search/records', { refs: unique.map(refKey).join(',') }).pipe(map((result) => result.hits));
  }

  favorites(): Observable<RecordHit[]> {
    return this.api.get<{ hits: RecordHit[] }>('favorites').pipe(map((result) => result.hits));
  }

  addFavorite(ref: RecordRef): Observable<RecordHit> {
    return this.api.put<RecordHit>(`favorites/${ref.type}/${ref.id}`);
  }

  removeFavorite(ref: RecordRef): Observable<void> {
    return this.api.delete(`favorites/${ref.type}/${ref.id}`);
  }
}
