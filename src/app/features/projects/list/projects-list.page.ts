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
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { userName } from '../../../shared/utils/display-name';
import { ProjectsApi, type Project } from '../projects-api.service';

/** The delivery pipeline (backend `ProjectStatus`). */
const STATUSES = ['planning', 'procurement', 'installation', 'testing_commissioning', 'customer_acceptance', 'warranty_service', 'closed', 'on_hold', 'cancelled'];

/** Project list columns (no money here: contract values are financial data). */
const PROJECT_COLUMNS: ColumnDef[] = [
  { id: 'number', labelKey: 'projects.columns.number', locked: true },
  { id: 'name', labelKey: 'projects.columns.name' },
  { id: 'customer', labelKey: 'prop.columns.customer' },
  { id: 'status', labelKey: 'projects.columns.status' },
  { id: 'progress', labelKey: 'projects.columns.progress' },
  { id: 'pm', labelKey: 'projects.columns.pm' },
  { id: 'targetEnd', labelKey: 'projects.columns.targetEnd' },
];

/** PROJ list (created when the PM accepts the delivery handover), with delayed / mine quick filters and saved views. */
@Component({
  selector: 'app-projects-list-page',
  imports: [
    RouterLink,
    TranslatePipe,
    StatusBadgeComponent,
    AlertComponent,
    BadgeComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    SavedViewsBarComponent,
    ColumnPickerComponent,
    TableSkeletonComponent,
    ...TABLE_IMPORTS,
  ],
  templateUrl: './projects-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ProjectsListPage {
  private readonly api = inject(ProjectsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly columns = new TableColumns('projects', PROJECT_COLUMNS);

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
