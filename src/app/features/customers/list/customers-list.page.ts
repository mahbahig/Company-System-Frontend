import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';
import { SavedViewsBarComponent } from '../../../shared/crm/saved-views/saved-views-bar.component';
import { ColumnPickerComponent } from '../../../shared/crm/table-columns/column-picker.component';
import { TableColumns, type ColumnDef } from '../../../shared/crm/table-columns/table-columns';
import { TableSkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

import { AuthService } from '../../../core/auth/auth.service';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../../shared/crm/list-toolbar/toggle-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TableBodyDirective } from '../../../shared/ui/table/table-body.directive';
import { TableCellDirective } from '../../../shared/ui/table/table-cell.directive';
import { TableEmptyComponent } from '../../../shared/ui/table/table-empty.component';
import { TableHeadDirective } from '../../../shared/ui/table/table-head.directive';
import { TableHeaderDirective } from '../../../shared/ui/table/table-header.directive';
import { TableRowDirective } from '../../../shared/ui/table/table-row.directive';
import { TableWrapperComponent } from '../../../shared/ui/table/table-wrapper.component';
import { TableDirective } from '../../../shared/ui/table/table.directive';
import { asUserRef } from '../../../shared/utils/display-name';
import { formatPhone, isOverdue } from '../../../shared/utils/format';
import { CustomersApi } from '../customers-api.service';
import type { Customer } from '../models/customer.interface';
import { RowLinkDirective } from '../../../shared/ui/table/row-link.directive';

const flag = (value: string | undefined) => value === '1' || value === 'true';

/** Customer list columns; the customer number always stays. */
const CUSTOMER_COLUMNS: ColumnDef[] = [
  { id: 'customerNo', labelKey: 'crm.customers.columns.customerNo', locked: true },
  { id: 'name', labelKey: 'crm.customers.columns.name' },
  { id: 'status', labelKey: 'crm.customers.columns.status' },
  { id: 'category', labelKey: 'crm.customers.columns.category' },
  { id: 'governorate', labelKey: 'crm.customers.columns.governorate' },
  { id: 'mobile', labelKey: 'crm.customers.columns.mobile' },
  { id: 'openOpportunities', labelKey: 'crm.customers.columns.openOpportunities' },
  { id: 'owner', labelKey: 'crm.customers.columns.owner' },
  { id: 'followUp', labelKey: 'crm.customers.columns.followUp' },
];

/** Customers list — same columns, filters and quick filters as the Next page. */
@Component({
  selector: 'app-customers-list-page',
  imports: [
    RowLinkDirective,
    SavedViewsBarComponent,
    ButtonDirective,
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    AlertComponent,
    BadgeComponent,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent,
    TableSkeletonComponent,
    ColumnPickerComponent,
    ShortcutDirective,
  ],
  templateUrl: './customers-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CustomersListPage {
  private readonly customers = inject(CustomersApi);
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly reference = inject(ReferenceDataService);

  // Query params (bound by the router).
  readonly q = input<string>();
  readonly status = input<string>();
  readonly category = input<string>();
  readonly governorate = input<string>();
  readonly mine = input<string>();
  readonly overdue = input<string>();
  readonly enrichmentOverdue = input<string>();
  /** Data-quality drill-down: `phone` or `governorate`. */
  readonly missing = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly formatPhone = formatPhone;
  protected readonly columns = new TableColumns('customers', CUSTOMER_COLUMNS);

  protected readonly result = rxResource({
    params: () => ({
      q: this.q(),
      missing: this.missing(),
      status: this.status(),
      category: this.category(),
      governorate: this.governorate(),
      mine: flag(this.mine()) || undefined,
      overdue: flag(this.overdue()) || undefined,
      enrichmentOverdue: flag(this.enrichmentOverdue()) || undefined,
      page: this.page(),
    }),
    stream: ({ params }) => this.customers.list(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly hasFilters = computed(
    () => !!(this.q() || this.status() || this.category() || this.governorate() || flag(this.mine()) || flag(this.overdue()) || flag(this.enrichmentOverdue())),
  );

  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('crm.customers.columns.status'), options: this.reference.options('customer_status'), value: this.status() ?? '' },
    { name: 'category', label: this.i18n.t('crm.customers.columns.category'), options: this.reference.options('customer_category'), value: this.category() ?? '' },
    { name: 'governorate', label: this.i18n.t('crm.customers.columns.governorate'), options: this.reference.options('governorate'), value: this.governorate() ?? '' },
  ]);

  protected readonly toggles = computed<ToggleDefinition[]>(() => [
    { name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: flag(this.mine()) },
    { name: 'overdue', label: this.i18n.t('crm.filters.followUpOverdue'), checked: flag(this.overdue()) },
    { name: 'enrichmentOverdue', label: this.i18n.t('ux.filters.enrichmentOverdue'), checked: flag(this.enrichmentOverdue()) },
  ]);

  constructor() {
    void this.reference.load();
  }

  protected displayName(customer: Customer): string {
    return this.i18n.pick(customer.nameAr, customer.nameEn) || customer.primaryContactName || '';
  }

  /** Second line under a company name: the primary contact. */
  protected contactLine(customer: Customer): string {
    return this.i18n.pick(customer.nameAr, customer.nameEn) ? (customer.primaryContactName ?? '') : '';
  }

  protected ownerName(customer: Customer): string {
    const owner = asUserRef(customer.ownerId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  protected overdueDate(value: string | null | undefined): boolean {
    return isOverdue(value);
  }
}
