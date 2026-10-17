import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../../shared/crm/list-toolbar/toggle-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { SavedViewsBarComponent } from '../../../shared/crm/saved-views/saved-views-bar.component';
import { ColumnPickerComponent } from '../../../shared/crm/table-columns/column-picker.component';
import { TableColumns, type ColumnDef } from '../../../shared/crm/table-columns/table-columns';
import { TableSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ContractsApi, type Contract } from '../contracts-api.service';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';

const STATUSES = ['draft', 'under_review', 'approved', 'sent_for_signature', 'signed_by_customer', 'fully_executed', 'active', 'completed', 'terminated', 'expired'];

/**
 * Contract list columns. The value is financial data: the API strips it for
 * roles without `financials.view`, and the column is not offered to them.
 */
const CONTRACT_COLUMNS: ColumnDef[] = [
  { id: 'number', labelKey: 'contracts.columns.number', locked: true },
  { id: 'customer', labelKey: 'prop.columns.customer' },
  { id: 'opportunity', labelKey: 'prop.columns.opportunity' },
  { id: 'status', labelKey: 'contracts.columns.status' },
  { id: 'value', labelKey: 'contracts.columns.value', permission: 'financials.view' },
  { id: 'date', labelKey: 'contracts.columns.date' },
];

/** CONTR list: contracts in scope, with a "pending" quick filter for those awaiting review or signature, and saved views. */
@Component({
  selector: 'app-contracts-list-page',
  imports: [
    RouterLink,
    TranslatePipe,
    StatusBadgeComponent,
    AlertComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    SavedViewsBarComponent,
    ColumnPickerComponent,
    TableSkeletonComponent,
    ...TABLE_IMPORTS,
  ],
  templateUrl: './contracts-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ContractsListPage {
  private readonly api = inject(ContractsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly columns = new TableColumns('contracts', CONTRACT_COLUMNS);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly pending = input<string>();
  /** Exceptions Center: sent for signature and not yet signed by both parties. */
  readonly awaitingSignature = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), pending: this.pending() === '1' || undefined, awaitingSignature: this.awaitingSignature() === '1' || undefined, page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('contracts.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.contractStatus.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [{ name: 'pending', label: this.i18n.t('contracts.pendingOnly'), checked: this.pending() === '1' }]);

  protected customer(row: Contract): string {
    return typeof row.customerId === 'object' ? this.i18n.pick(row.customerId.nameAr, row.customerId.nameEn) : '—';
  }

  protected opportunity(row: Contract): string {
    return typeof row.opportunityId === 'object' ? row.opportunityId.name : '—';
  }
}
