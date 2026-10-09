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
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { userName } from '../../../shared/utils/display-name';
import { ProjectsApi, type Project } from '../projects-api.service';

const STATUSES = ['created', 'planning', 'procurement', 'installation', 'testing_commissioning', 'handover', 'closed', 'on_hold', 'cancelled'];

/** PROJ list (auto-created from signed contracts), with delayed / mine quick filters. */
@Component({
  selector: 'app-projects-list-page',
  imports: [RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, BadgeComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS],
  template: `
    <app-page-header [heading]="'projects.title' | t" [subtitle]="'projects.subtitle' | t" class="!mb-0" />
    <app-list-toolbar [searchValue]="q() ?? ''" [filters]="filters()" [toggles]="toggles()" />
    @if (result.error()) {
      <app-alert variant="destructive">{{ i18n.errorText(result.error()) }}</app-alert>
    }
    <app-table-wrapper [label]="'projects.title' | t" [attr.aria-busy]="result.isLoading()">
      <table appTable>
        <thead appTableHeader>
          <tr appTableRow>
            <th appTableHead>{{ 'projects.columns.number' | t }}</th>
            <th appTableHead>{{ 'projects.columns.name' | t }}</th>
            <th appTableHead>{{ 'prop.columns.customer' | t }}</th>
            <th appTableHead>{{ 'projects.columns.status' | t }}</th>
            <th appTableHead>{{ 'projects.columns.progress' | t }}</th>
            <th appTableHead>{{ 'projects.columns.pm' | t }}</th>
            <th appTableHead>{{ 'projects.columns.targetEnd' | t }}</th>
          </tr>
        </thead>
        <tbody appTableBody>
          @for (row of rows(); track row.id) {
            <tr appTableRow>
              <td appTableCell class="tabular whitespace-nowrap"><a class="text-primary hover:underline" [routerLink]="row.id" dir="ltr">{{ row.projectNo }}</a></td>
              <td appTableCell>{{ row.name }}</td>
              <td appTableCell>{{ customer(row) }}</td>
              <td appTableCell>
                <app-status-badge enum="projectStatus" [value]="row.status" />
                @if (row.isDelayed) {
                  <app-badge tone="danger" class="ms-1">{{ 'projects.delayed' | t }}</app-badge>
                }
              </td>
              <td appTableCell class="tabular">{{ row.installationProgressPct }}%</td>
              <td appTableCell>{{ name(row.pmId) }}</td>
              <td appTableCell class="tabular whitespace-nowrap">{{ i18n.formatDate(row.targetEndDate) || '—' }}</td>
            </tr>
          } @empty {
            <tr app-table-empty [colSpan]="7">{{ (result.isLoading() ? 'common.labels.loading' : 'projects.empty') | t }}</tr>
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
export class ProjectsListPage {
  private readonly api = inject(ProjectsApi);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly delayed = input<string>();
  readonly mine = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), delayed: this.delayed() === '1' || undefined, mine: this.mine() === '1' || undefined, page: this.page() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('projects.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`enums.projectStatus.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [
    { name: 'delayed', label: this.i18n.t('projects.delayed'), checked: this.delayed() === '1' },
    { name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: this.mine() === '1' },
  ]);

  protected customer(row: Project): string {
    return typeof row.customerId === 'object' ? this.i18n.pick(row.customerId.nameAr, row.customerId.nameEn) : '—';
  }

  protected name(value: Project['pmId']): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value ?? null);
  }
}
