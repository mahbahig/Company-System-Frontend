import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { StatusBadgeComponent } from '../../../shared/crm/status-badge/status-badge.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { userName } from '../../../shared/utils/display-name';
import { ActivitiesApi, refLabel, type Meeting } from '../activities-api.service';

const STATUSES = ['planned', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'];

/** E12 meetings. */
@Component({
  selector: 'app-meetings-list-page',
  imports: [RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'act.meetings.title' | t" [subtitle]="'act.meetings.subtitle' | t" class="!mb-0">
      @if (auth.can('meetings.create')) {
        <a appButton routerLink="new">{{ 'act.meetings.new' | t }}</a>
      }
    </app-page-header>
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'act.meetings.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'act.fields.subject' | t }}</th>
            <th appTableHead>{{ 'act.columns.when' | t }}</th>
            <th appTableHead>{{ 'act.fields.customer' | t }}</th>
            <th appTableHead>{{ 'act.fields.mode' | t }}</th>
            <th appTableHead>{{ 'act.columns.status' | t }}</th>
            <th appTableHead>{{ 'act.columns.owner' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell><a class="text-primary hover:underline" [routerLink]="row.id">{{ row.subject }}</a></td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.scheduledAt, true) }}</td>
              <td appTableCell>{{ customer(row) }}</td>
              <td appTableCell>{{ row.mode | enum: 'meetingMode' }}</td>
              <td appTableCell><app-status-badge enum="meetingStatus" [value]="row.status" /></td>
              <td appTableCell>{{ owner(row) }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="6">{{ (result.isLoading() ? 'common.labels.loading' : 'act.empty') | t }}</tr>
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
export class MeetingsListPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({ params: () => ({ q: this.q(), status: this.status(), page: this.page() }), stream: ({ params }) => this.api.meetings(params) });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('act.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.meetingStatus.${value}`) })), value: this.status() ?? '' },
  ]);

  protected customer(row: Meeting): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), row.customerId) || '—';
  }

  protected owner(row: Meeting): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.ownerId);
  }
}
