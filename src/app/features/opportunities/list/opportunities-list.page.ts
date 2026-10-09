import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SavedViewsBarComponent } from '../../../shared/crm/saved-views/saved-views-bar.component';

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
import { OpportunitiesApi } from '../opportunities-api.service';
import type { Opportunity } from '../models/opportunity.interface';

const flag = (value: string | undefined) => value === '1';

/** Opportunities list — filters, "collaborating on me" toggle, same anatomy as the customers list. */
@Component({
  selector: 'app-opportunities-list-page',
  imports: [
    SavedViewsBarComponent,
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    ListToolbarComponent,
    PaginationComponent,
    AlertComponent,
    BadgeComponent,
    ButtonDirective,
    TableWrapperComponent,
    TableDirective,
    TableHeaderDirective,
    TableBodyDirective,
    TableRowDirective,
    TableHeadDirective,
    TableCellDirective,
    TableEmptyComponent,
  ],
  templateUrl: './opportunities-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class OpportunitiesListPage {
  private readonly opportunities = inject(OpportunitiesApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly auth = inject(AuthService);

  // Query params (bound by the router).
  readonly q = input<string>();
  readonly stage = input<string>();
  readonly outcome = input<string>();
  readonly solutionType = input<string>();
  readonly priority = input<string>();
  readonly mine = input<string>();
  readonly collaborating = input<string>();
  readonly nextActionOverdue = input<string>();
  /** Drill-downs from the exception / data-quality centre. */
  readonly health = input<string>();
  readonly incomplete = input<string>();
  readonly intakeIncomplete = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly canCreate = computed(() => this.auth.can('opportunities.create'));

  protected readonly result = rxResource({
    params: () => ({
      q: this.q(),
      stage: this.stage(),
      outcome: this.outcome(),
      solutionType: this.solutionType(),
      priority: this.priority(),
      mine: flag(this.mine()) || undefined,
      collaborating: flag(this.collaborating()) || undefined,
      nextActionOverdue: flag(this.nextActionOverdue()) || undefined,
      health: this.health(),
      incomplete: flag(this.incomplete()) || undefined,
      intakeIncomplete: flag(this.intakeIncomplete()) || undefined,
      page: this.page(),
    }),
    stream: ({ params }) => this.opportunities.list(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly hasFilters = computed(
    () =>
      !!(
        this.q() ||
        this.stage() ||
        this.outcome() ||
        this.solutionType() ||
        this.priority() ||
        flag(this.mine()) ||
        flag(this.collaborating()) ||
        flag(this.nextActionOverdue())
      ),
  );

  private readonly outcomeOptions = ['open', 'won', 'lost', 'cancelled', 'on_hold'];
  private readonly priorityOptions = ['low', 'normal', 'high', 'urgent'];

  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'stage', label: this.i18n.t('crm.opportunities.columns.stage'), options: this.reference.options('pipeline_stage'), value: this.stage() ?? '' },
    {
      name: 'outcome',
      label: this.i18n.t('crm.opportunities.columns.outcome'),
      options: this.outcomeOptions.map((value) => ({ value, label: this.i18n.t(`crm.opportunities.outcome.${value}`) })),
      value: this.outcome() ?? '',
    },
    { name: 'solutionType', label: this.i18n.t('crm.opportunities.fields.solutionTypeCode'), options: this.reference.options('solution_type'), value: this.solutionType() ?? '' },
    {
      name: 'priority',
      label: this.i18n.t('crm.opportunities.fields.priority'),
      options: this.priorityOptions.map((value) => ({ value, label: this.i18n.t(`crm.opportunities.priority.${value}`) })),
      value: this.priority() ?? '',
    },
  ]);

  protected readonly toggles = computed<ToggleDefinition[]>(() => [
    { name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: flag(this.mine()) },
    { name: 'collaborating', label: this.i18n.t('crm.opportunities.collaboratingOnMe'), checked: flag(this.collaborating()) },
    { name: 'nextActionOverdue', label: this.i18n.t('crm.opportunities.nextActionOverdue'), checked: flag(this.nextActionOverdue()) },
  ]);

  constructor() {
    void this.reference.load();
  }

  protected customerName(ref: Opportunity['customerId']): string {
    return typeof ref === 'string' ? '' : this.i18n.pick(ref.nameAr, ref.nameEn) || ref.primaryContactName || '';
  }

  protected ownerName(opportunity: Opportunity): string {
    const owner = asUserRef(opportunity.ownerId);
    return owner ? this.i18n.pick(owner.fullNameAr, owner.fullNameEn) : this.i18n.t('crm.common.unassigned');
  }

  protected healthTone(status: string | undefined): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'watch':
        return 'info';
      case 'at_risk':
        return 'warning';
      case 'critical':
        return 'danger';
      default:
        return 'neutral';
    }
  }
}
