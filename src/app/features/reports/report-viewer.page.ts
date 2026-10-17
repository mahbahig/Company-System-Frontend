import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ReferenceDataService } from '../../core/reference/reference-data.service';
import type { ReferenceType } from '../../core/reference/reference-type';
import { enumLabel } from '../../shared/crm/status-badge/status-badge.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../shared/ui/table/table.imports';
import { ActionRunner } from '../../shared/utils/action-runner';
import { AnalyticsFilterBarComponent } from '../analytics/shared/analytics-filter-bar.component';
import { ReportsApi, type ReportColumn, type ReportQuery } from './reports-api.service';
import { SkeletonRowComponent } from '../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../shared/crm/pagination/page-size';
import { PaginationComponent } from '../../shared/crm/pagination/pagination.component';

/**
 * RPT-02/03 one report: the same filters as the dashboards (from the URL),
 * scoped to the user's data, and exported as CSV / Excel / PDF in the current
 * language (exports are audited; money columns are removed without
 * `financials.view`).
 */
@Component({
  selector: 'app-report-viewer-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, AlertComponent, ButtonDirective, PageHeaderComponent, AnalyticsFilterBarComponent, ...TABLE_IMPORTS, PaginationComponent],
  templateUrl: './report-viewer.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ReportViewerPage {
  private readonly api = inject(ReportsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly reference = inject(ReferenceDataService);
  protected readonly actions = new ActionRunner(this.i18n);
  protected readonly formats = ['xlsx', 'csv', 'pdf'] as const;

  readonly code = input.required<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly ownerId = input<string>();
  readonly sourceCode = input<string>();
  readonly campaignCode = input<string>();
  readonly governorateCode = input<string>();
  readonly solutionTypeCode = input<string>();
  /** `?page=` / `?pageSize=` of the rows (exports always hold every row). */
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly query = computed<ReportQuery>(() => ({
    from: this.from(),
    to: this.to(),
    ownerId: this.ownerId(),
    sourceCode: this.sourceCode(),
    campaignCode: this.campaignCode(),
    governorateCode: this.governorateCode(),
    solutionTypeCode: this.solutionTypeCode(),
  }));

  private readonly catalogue = rxResource({ stream: () => this.api.list() });
  protected readonly data = rxResource({
    params: () => ({ code: this.code(), query: this.query(), paging: { page: this.page(), pageSize: this.pageSize() } }),
    stream: ({ params }) => this.api.run(params.code, params.query, params.paging),
  });
  protected readonly columns = computed(() => this.data.value()?.columns ?? []);
  protected readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly title = computed(() => {
    const entry = this.catalogue.value()?.find((r) => r.code === this.code());
    return entry ? this.i18n.pick(entry.titleAr, entry.titleEn) : this.i18n.t('reports.title');
  });
  protected readonly subtitle = computed(() => {
    const result = this.data.value();
    return result ? this.i18n.t('reports.summary', { count: this.i18n.formatNumber(result.total), scope: this.i18n.t(`reports.scope.${result.scope}`) }) : '';
  });

  protected cell(column: ReportColumn, value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return this.i18n.t(value ? 'crm.common.yes' : 'crm.common.no');
    if (typeof value === 'number') return this.i18n.formatNumber(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return this.i18n.formatDate(value);
    if (column.ref) return this.reference.label(column.ref as ReferenceType, value);
    if (column.enum) return enumLabel(this.i18n, column.enum, value);
    return value;
  }

  protected download(format: 'csv' | 'xlsx' | 'pdf'): void {
    void this.actions.run(this.api.export(this.code(), { ...this.query(), format, locale: this.i18n.locale() }), null);
  }
}
