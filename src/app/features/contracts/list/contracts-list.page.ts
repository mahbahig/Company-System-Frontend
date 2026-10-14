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
  template: `
    <app-page-header [heading]="'contracts.title' | t" [subtitle]="'contracts.subtitle' | t" class="!mb-0" />
    <div class="flex flex-wrap items-start justify-between gap-2">
      <app-saved-views-bar list="contracts" />
      <app-column-picker [columns]="columns" />
    </div>
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" [toggles]="toggles()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'contracts.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            @if (columns.show('number')) {
              <th appTableHead>{{ 'contracts.columns.number' | t }}</th>
            }
            @if (columns.show('customer')) {
              <th appTableHead>{{ 'prop.columns.customer' | t }}</th>
            }
            @if (columns.show('opportunity')) {
              <th appTableHead>{{ 'prop.columns.opportunity' | t }}</th>
            }
            @if (columns.show('status')) {
              <th appTableHead>{{ 'contracts.columns.status' | t }}</th>
            }
            @if (columns.show('value')) {
              <th appTableHead>{{ 'contracts.columns.value' | t }}</th>
            }
            @if (columns.show('date')) {
              <th appTableHead>{{ 'contracts.columns.date' | t }}</th>
            }
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow [appRowLink]="row.id">
              @if (columns.show('number')) {
                <td appTableCell class="tabular whitespace-nowrap"><a class="text-primary hover:underline" [routerLink]="row.id" dir="ltr">{{ row.contractNo }}</a></td>
              }
              @if (columns.show('customer')) {
                <td appTableCell>{{ customer(row) }}</td>
              }
              @if (columns.show('opportunity')) {
                <td appTableCell>{{ opportunity(row) }}</td>
              }
              @if (columns.show('status')) {
                <td appTableCell><app-status-badge enum="contractStatus" [value]="row.status" /></td>
              }
              @if (columns.show('value')) {
                <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.value) }}</td>
              }
              @if (columns.show('date')) {
                <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.contractDate) || '—' }}</td>
              }
            </tr>
          } @empty {
            @if (!result.isLoading()) {
              <tr app-table-empty [colSpan]="columns.count()">{{ 'contracts.empty' | t }}</tr>
            }
          }
        </tbody>
        @if (result.isLoading() && rows().length === 0) {
          <tbody app-table-skeleton [columns]="columns.count()"></tbody>
        }
      </table>
    </app-table-wrapper>
    @if (result.hasValue()) {
      <app-pagination [page]="result.value().page" [pageCount]="result.value().pageCount" [total]="result.value().total" [pageSize]="result.value().pageSize" />
    }
  `,
  host: { class: 'flex flex-col gap-6' },
})
export class ContractsListPage {
  private readonly api = inject(ContractsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly columns = new TableColumns('contracts', CONTRACT_COLUMNS);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly pending = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), pending: this.pending() === '1' || undefined, page: this.page() }),
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
