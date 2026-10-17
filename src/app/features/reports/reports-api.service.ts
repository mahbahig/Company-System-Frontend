import { Service, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { AnalyticsFilter } from '../analytics/models/analytics-filter.interface';

export interface ReportColumn {
  key: string;
  labelAr: string;
  labelEn: string;
  numeric: boolean;
  /** Reference-data type: values are codes shown with their label. */
  ref?: string;
  /** Enum name: values are shown with `enums.<name>` labels. */
  enum?: string;
}

export interface ReportSummary {
  code: string;
  group: 'sales' | 'marketing' | 'operations' | 'finance' | 'quality' | 'management';
  titleAr: string;
  titleEn: string;
  filters: string[];
  columns: ReportColumn[];
  exportable: boolean;
}

export interface ReportResult {
  code: string;
  scope: string;
  columns: ReportColumn[];
  /** The requested page of rows; `total` counts every row in scope. */
  rows: Array<Record<string, string | number | boolean | null>>;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type ReportQuery = AnalyticsFilter & { status?: string; q?: string };

/** RPT-01..03 report catalogue, run and export. */
@Service()
export class ReportsApi {
  private readonly api = inject(ApiService);

  list(): Observable<ReportSummary[]> {
    return this.api.get<{ reports: ReportSummary[] }>('reports').pipe(map((body) => body.reports));
  }
  run(code: string, query: ReportQuery, paging: { page: number; pageSize: number } = { page: 1, pageSize: 20 }): Observable<ReportResult> {
    return this.api.get(`reports/${code}`, { ...query, ...paging });
  }
  export(code: string, query: ReportQuery & { format: 'csv' | 'xlsx' | 'pdf'; locale: string }): Observable<void> {
    return this.api.download(`reports/${code}/export`, { ...query }, `${code}.${query.format}`);
  }
}
