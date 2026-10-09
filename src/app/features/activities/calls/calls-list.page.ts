import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { userName } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { ActivitiesApi, refLabel, type Call } from '../activities-api.service';

/** E11 call log. */
@Component({
  selector: 'app-calls-list-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'act.calls.title' | t" [subtitle]="'act.calls.subtitle' | t" class="!mb-0">
      @if (auth.can('calls.create')) {
        <a appButton routerLink="new">{{ 'act.calls.new' | t }}</a>
      }
    </app-page-header>
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'act.calls.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'act.columns.when' | t }}</th>
            <th appTableHead>{{ 'act.columns.direction' | t }}</th>
            <th appTableHead>{{ 'act.columns.with' | t }}</th>
            <th appTableHead>{{ 'act.columns.phone' | t }}</th>
            <th appTableHead>{{ 'act.columns.outcome' | t }}</th>
            <th appTableHead>{{ 'act.columns.owner' | t }}</th>
            <th appTableHead>{{ 'act.columns.followUp' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap"><a class="text-primary hover:underline" [routerLink]="row.id">{{ i18n.formatDate(row.occurredAt, true) }}</a></td>
              <td appTableCell>{{ row.direction | enum: 'callDirection' }}</td>
              <td appTableCell>{{ withWhom(row) }}</td>
              <td appTableCell class="tabular" dir="ltr">{{ row.phoneNumber ? formatPhone(row.phoneNumber) : '—' }}</td>
              <td appTableCell>{{ reference.label('call_outcome', row.outcomeCode) }}</td>
              <td appTableCell>{{ owner(row) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.followUpAt) || '—' }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="7">{{ (result.isLoading() ? 'common.labels.loading' : 'act.empty') | t }}</tr>
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
export class CallsListPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly formatPhone = formatPhone;

  readonly q = input<string>();
  readonly direction = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({ params: () => ({ q: this.q(), direction: this.direction(), page: this.page() }), stream: ({ params }) => this.api.calls(params) });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'direction', label: this.i18n.t('act.columns.direction'), options: ['inbound', 'outbound'].map((value) => ({ value, label: this.i18n.t(`enums.callDirection.${value}`) })), value: this.direction() ?? '' },
  ]);

  constructor() {
    void this.reference.load();
  }

  protected withWhom(row: Call): string {
    const pick = (ar?: string | null, en?: string | null) => this.i18n.pick(ar, en);
    return refLabel(pick, row.customerId) || refLabel(pick, row.leadId) || refLabel(pick, row.opportunityId) || '—';
  }

  protected owner(row: Call): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.ownerId);
  }
}
