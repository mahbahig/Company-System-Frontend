import { Service, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { Page } from '../../core/api/page.interface';

export interface ImportField {
  key: string;
  labelEn: string;
  labelAr: string;
  required?: boolean;
  numeric?: boolean;
  reference?: string;
}

export interface ImportJob {
  id: string;
  jobNo: string;
  entity: 'lead' | 'customer';
  fileName: string;
  status: string;
  headers: string[];
  mapping: Record<string, string>;
  defaults: Record<string, string | undefined>;
  counts: Record<string, number>;
  totalRows: number;
  processedRows: number;
  error?: string | null;
  validatedAt?: string | null;
  committedAt?: string | null;
  rolledBackAt?: string | null;
  rollbackResult?: { removed: number; kept: number } | null;
  createdAt: string;
}

export interface ImportRowMatch {
  kind: 'customer' | 'lead' | 'row';
  id: string;
  label: string;
  score: number;
}

export interface ImportRow {
  id: string;
  rowNo: number;
  raw: Record<string, string>;
  data: Record<string, unknown>;
  overrides: Record<string, unknown>;
  status: string;
  issues: Record<string, string>;
  matches: ImportRowMatch[];
  decision: 'pending' | 'create' | 'skip' | 'link';
  linkedId?: string | null;
}

/** DUP-09/10 import jobs: upload, map, validate, review, commit, roll back. */
@Service()
export class ImportsApi {
  private readonly api = inject(ApiService);

  list(query: { page?: number; entity?: string; status?: string }): Observable<Page<ImportJob>> {
    return this.api.get('imports', query);
  }
  fields(entity: string): Observable<ImportField[]> {
    return this.api.get<{ fields: ImportField[] }>(`imports/fields/${entity}`).pipe(map((body) => body.fields));
  }
  upload(entity: string, file: File): Observable<ImportJob> {
    const form = new FormData();
    form.append('entity', entity);
    form.append('file', file);
    return this.api.upload('imports', form);
  }
  get(id: string): Observable<ImportJob> {
    return this.api.get(`imports/${id}`);
  }
  setMapping(id: string, body: { mapping: Record<string, string>; defaults?: Record<string, string | undefined> }): Observable<ImportJob> {
    return this.api.put(`imports/${id}/mapping`, body);
  }
  validate(id: string): Observable<ImportJob> {
    return this.api.post(`imports/${id}/validate`);
  }
  rows(id: string, query: { page?: number; status?: string; decision?: string }): Observable<Page<ImportRow>> {
    return this.api.get(`imports/${id}/rows`, query);
  }
  decide(id: string, rowId: string, body: { decision?: 'create' | 'skip' | 'link'; linkedId?: string; overrides?: Record<string, unknown> }): Observable<ImportRow> {
    return this.api.patch(`imports/${id}/rows/${rowId}`, body);
  }
  decideAll(id: string, body: { status: 'duplicate' | 'valid' | 'invalid'; decision: 'create' | 'skip' }): Observable<unknown> {
    return this.api.post(`imports/${id}/rows/decide`, body);
  }
  commit(id: string, skipUndecided: boolean): Observable<ImportJob> {
    return this.api.post(`imports/${id}/commit`, { skipUndecided });
  }
  rollback(id: string): Observable<ImportJob> {
    return this.api.post(`imports/${id}/rollback`);
  }
  errorReport(id: string, jobNo: string): Observable<void> {
    return this.api.download(`imports/${id}/error-report`, undefined, `${jobNo}-errors.csv`);
  }
}
