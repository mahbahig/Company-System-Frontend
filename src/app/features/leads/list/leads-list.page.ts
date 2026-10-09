import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SavedViewsBarComponent } from '../../../shared/crm/saved-views/saved-views-bar.component';
import { UserSelectComponent } from '../../../shared/crm/user-select/user-select.component';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import type { ToggleDefinition } from '../../../shared/crm/list-toolbar/toggle-definition.interface';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CardDirective } from '../../../shared/ui/card/card.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { LabelComponent } from '../../../shared/ui/form/label.component';
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
import { daysSince, formatPhone, isOverdue } from '../../../shared/utils/format';
import { LeadsApi } from '../leads-api.service';
import type { Lead } from '../models/lead.interface';

const flag = (value: string | undefined) => value === '1';
const SLA_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  on_track: 'success',
  met: 'success',
  due_soon: 'warning',
  breached: 'danger',
  not_started: 'neutral',
};
const PRIORITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

interface AssignModel {
  ownerId: string;
  reason: string;
}

/** Central Lead Bank (`LEAD-03..05`): every lead, filterable, with bulk assignment. */
@Component({
  selector: 'app-leads-list-page',
  imports: [
    UserSelectComponent,
    SavedViewsBarComponent,
    RouterLink,
    FormField,
    TranslatePipe,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    CardDirective,
    InputDirective,
    LabelComponent,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent,
  ],
  templateUrl: './leads-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadsListPage {
  private readonly leads = inject(LeadsApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  // Query params (bound by the router).
  readonly q = input<string>();
  readonly status = input<string>();
  readonly intakeMode = input<string>();
  readonly source = input<string>();
  readonly priority = input<string>();
  readonly governorate = input<string>();
  readonly category = input<string>();
  readonly sla = input<string>();
  readonly unassigned = input<string>();
  readonly includeClosed = input<string>();
  /** Data-quality drill-down: `phone` or `governorate`. */
  readonly missing = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly formatPhone = formatPhone;

  protected readonly result = rxResource({
    params: () => ({
      q: this.q(),
      missing: this.missing(),
      status: this.status(),
      intakeMode: this.intakeMode(),
      source: this.source(),
      priority: this.priority(),
      governorate: this.governorate(),
      category: this.category(),
      sla: this.sla(),
      unassigned: flag(this.unassigned()) || undefined,
      includeClosed: flag(this.includeClosed()) || undefined,
      page: this.page(),
    }),
    stream: ({ params }) => this.leads.bank(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly hasFilters = computed(
    () =>
      !!(
        this.q() ||
        this.status() ||
        this.intakeMode() ||
        this.source() ||
        this.priority() ||
        this.governorate() ||
        this.category() ||
        this.sla() ||
        flag(this.unassigned()) ||
        flag(this.includeClosed())
      ),
  );

  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('crm.leads.columns.status'), options: this.reference.options('lead_status'), value: this.status() ?? '' },
    { name: 'source', label: this.i18n.t('crm.leads.columns.source'), options: this.reference.options('lead_source'), value: this.source() ?? '' },
    {
      name: 'priority',
      label: this.i18n.t('crm.leads.columns.urgency'),
      options: (['low', 'normal', 'high', 'urgent'] as const).map((value) => ({ value, label: this.i18n.t(`crm.leads.urgency.${value}`) })),
      value: this.priority() ?? '',
    },
    { name: 'category', label: this.i18n.t('crm.leads.columns.customerType'), options: this.reference.options('customer_category'), value: this.category() ?? '' },
    { name: 'governorate', label: this.i18n.t('crm.leads.columns.governorate'), options: this.reference.options('governorate'), value: this.governorate() ?? '' },
    {
      name: 'intakeMode',
      label: this.i18n.t('crm.leads.columns.intakeMode'),
      options: (['self_sourced', 'bank'] as const).map((value) => ({ value, label: this.i18n.t(`enums.intakeMode.${value}`) })),
      value: this.intakeMode() ?? '',
    },
    {
      name: 'sla',
      label: this.i18n.t('crm.leads.columns.slaStatus'),
      options: (['on_track', 'due_soon', 'breached', 'met', 'not_started'] as const).map((value) => ({ value, label: this.i18n.t(`enums.slaState.${value}`) })),
      value: this.sla() ?? '',
    },
  ]);

  protected readonly toggles = computed<ToggleDefinition[]>(() => [
    { name: 'unassigned', label: this.i18n.t('crm.leads.toggles.unassignedOnly'), checked: flag(this.unassigned()) },
    { name: 'includeClosed', label: this.i18n.t('crm.leads.toggles.includeClosed'), checked: flag(this.includeClosed()) },
  ]);

  // ---------------------------------------------------------------------------
  // Bulk selection + assignment (LEAD-05/10).
  // ---------------------------------------------------------------------------

  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly assignError = signal<string | null>(null);
  protected readonly assignDone = signal(false);
  protected readonly assignOverride = signal(false);

  private readonly assignModel = signal<AssignModel>({ ownerId: '', reason: '' });
  protected readonly assignForm = form(this.assignModel, (path) => {
    required(path.ownerId, { message: 'validation.required' });
    required(path.reason, { message: 'validation.required' });
  });

  protected toggleSelected(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
    this.assignDone.set(false);
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected async onAssignSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.assignForm().markAsTouched();
    if (this.assignForm().invalid()) return;
    this.assignError.set(null);
    try {
      await firstValueFrom(
        this.leads.assign({ leadIds: [...this.selected()], ownerId: this.assignModel().ownerId, reason: this.assignModel().reason, overrideCapacity: this.assignOverride() || undefined }),
      );
      this.assignDone.set(true);
      this.clearSelection();
      this.assignModel.set({ ownerId: '', reason: '' });
      this.assignOverride.set(false);
      this.result.reload();
    } catch (error) {
      this.assignError.set(ApiError.is(error) && this.i18n.has(error.messageKey) ? error.messageKey : 'errors.db.unexpected');
    }
  }

  // ---------------------------------------------------------------------------

  protected ownerName(lead: Lead): string {
    const owner = asUserRef(lead.ownerId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  protected overdueDate(value: string | null | undefined): boolean {
    return isOverdue(value);
  }

  protected leadAgeDays(lead: Lead): number | null {
    return daysSince(lead.createdAt);
  }

  protected slaTone(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
    return SLA_TONE[state] ?? 'neutral';
  }

  protected priorityTone(priority: string): 'neutral' | 'info' | 'warning' | 'danger' {
    return PRIORITY_TONE[priority] ?? 'neutral';
  }

  constructor() {
    void this.reference.load();
  }
}
