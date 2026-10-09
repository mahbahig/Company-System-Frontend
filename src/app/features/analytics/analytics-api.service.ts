import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import type { AnalyticsFilter } from './models/analytics-filter.interface';
import type { DashboardCode, ExecutiveDashboard, FinanceDashboard, MarketingDashboard, OperationalDashboard, PersonalDashboard, SalesDashboard } from './models/dashboards.interface';
import type { DataQualityDashboard, ExceptionDetail, ExceptionSummary, SearchHit } from './models/exceptions.interface';
import type { KpiMap } from './models/kpi-value.interface';

/** Typed client for dashboards, KPIs, the Exception Center, data quality and global search. */
@Service()
export class AnalyticsApi {
  private readonly api = inject(ApiService);

  available(): Observable<{ dashboards: DashboardCode[] }> {
    return this.api.get('dashboards');
  }

  personal(filter: AnalyticsFilter): Observable<PersonalDashboard> {
    return this.api.get('dashboards/personal', { ...filter });
  }

  executive(filter: AnalyticsFilter): Observable<ExecutiveDashboard> {
    return this.api.get('dashboards/executive', { ...filter });
  }

  sales(filter: AnalyticsFilter): Observable<SalesDashboard> {
    return this.api.get('dashboards/sales', { ...filter });
  }

  marketing(filter: AnalyticsFilter): Observable<MarketingDashboard> {
    return this.api.get('dashboards/marketing', { ...filter });
  }

  operational(filter: AnalyticsFilter): Observable<OperationalDashboard> {
    return this.api.get('dashboards/operational', { ...filter });
  }

  finance(filter: AnalyticsFilter): Observable<FinanceDashboard> {
    return this.api.get('dashboards/finance', { ...filter });
  }

  kpis(filter: AnalyticsFilter): Observable<KpiMap> {
    return this.api.get('kpis', { ...filter });
  }

  exceptions(filter: AnalyticsFilter = {}): Observable<{ scope: string; items: ExceptionSummary[]; total: number }> {
    return this.api.get('exceptions', { ...filter });
  }

  exception(code: string): Observable<ExceptionDetail> {
    return this.api.get(`exceptions/${code}`);
  }

  exceptionBadge(): Observable<{ count: number }> {
    return this.api.get('exceptions/badge');
  }

  dataQuality(filter: AnalyticsFilter = {}): Observable<DataQualityDashboard> {
    return this.api.get('data-quality', { ...filter });
  }

  search(q: string): Observable<{ query: string; hits: SearchHit[] }> {
    return this.api.get('search', { q });
  }
}
