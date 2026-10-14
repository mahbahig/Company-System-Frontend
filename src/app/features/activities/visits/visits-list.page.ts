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
import { ActivitiesApi, refLabel, type Visit } from '../activities-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';

const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'];
const PURPOSES = ['survey', 'technical_assessment', 'presentation', 'installation_check', 'follow_up', 'other'];

/** E13 site visits. */
@Component({
  selector: 'app-visits-list-page',
  imports: [ShortcutDirective, SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'act.visits.title' | t" [subtitle]="'act.visits.subtitle' | t" class="!mb-0">
      @if (auth.can('visits.create')) {
        <a appButton routerLink="new" appShortcut="n">{{ 'act.visits.new' | t }}</a>
      }
    </app-page-header>
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'act.visits.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'act.fields.visitNo' | t }}</th>
            <th appTableHead>{{ 'act.columns.when' | t }}</th>
            <th appTableHead>{{ 'act.fields.customer' | t }}</th>
            <th appTableHead>{{ 'act.fields.purpose' | t }}</th>
            <th appTableHead>{{ 'act.columns.status' | t }}</th>
            <th appTableHead>{{ 'act.columns.owner' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow [appRowLink]="row.id">
              <td appTableCell><a class="tabular text-primary hover:underline" [routerLink]="row.id">{{ row.visitNo }}</a></td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.scheduledAt, true) }}</td>
              <td appTableCell>{{ customer(row) }}</td>
              <td appTableCell>{{ row.purpose | enum: 'visitPurpose' }}</td>
              <td appTableCell><app-status-badge enum="visitStatus" [value]="row.status" /></td>
              <td appTableCell>{{ owner(row) }}</td>
            </tr>
          } @empty {
            @if (result.isLoading()) {
              @for (i of [0, 1, 2, 3, 4]; track i) {
                <tr app-skeleton-row [columns]="6" [index]="i"></tr>
              }
            } @else {
              <tr app-table-empty [colSpan]="6">{{ 'act.empty' | t }}</tr>
            }
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
export class VisitsListPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly purpose = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), purpose: this.purpose(), page: this.page() }),
    stream: ({ params }) => this.api.visits(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('act.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.visitStatus.${value}`) })), value: this.status() ?? '' },
    { name: 'purpose', label: this.i18n.t('act.fields.purpose'), options: PURPOSES.map((value) => ({ value, label: this.i18n.t(`enums.visitPurpose.${value}`) })), value: this.purpose() ?? '' },
  ]);

  protected customer(row: Visit): string {
    return refLabel((ar, en) => this.i18n.pick(ar, en), row.customerId) || '—';
  }

  protected owner(row: Visit): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.ownerId);
  }
}
