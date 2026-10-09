import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../../shared/crm/list-toolbar/toggle-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ContractsApi, type Contract } from '../contracts-api.service';

const STATUSES = ['draft', 'under_review', 'approved', 'sent_for_signature', 'signed_by_customer', 'fully_executed', 'active', 'completed', 'terminated', 'expired'];

/** CONTR list: contracts in scope, with a "pending" quick filter for those awaiting review or signature. */
@Component({
  selector: 'app-contracts-list-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'contracts.title' | t" [subtitle]="'contracts.subtitle' | t" class="!mb-0" />
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" [toggles]="toggles()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'contracts.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'contracts.columns.number' | t }}</th>
            <th appTableHead>{{ 'prop.columns.customer' | t }}</th>
            <th appTableHead>{{ 'prop.columns.opportunity' | t }}</th>
            <th appTableHead>{{ 'contracts.columns.status' | t }}</th>
            <th appTableHead>{{ 'contracts.columns.value' | t }}</th>
            <th appTableHead>{{ 'contracts.columns.date' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap"><a class="text-primary hover:underline" [routerLink]="row.id" dir="ltr">{{ row.contractNo }}</a></td>
              <td appTableCell>{{ customer(row) }}</td>
              <td appTableCell>{{ opportunity(row) }}</td>
              <td appTableCell><app-status-badge enum="contractStatus" [value]="row.status" /></td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatMoney(row.value) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.contractDate) || '—' }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="6">{{ (result.isLoading() ? 'common.labels.loading' : 'contracts.empty') | t }}</tr>
          }
        </tbody>
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
