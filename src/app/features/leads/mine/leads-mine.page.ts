import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
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
import { formatPhone, isOverdue } from '../../../shared/utils/format';
import { LeadsApi } from '../leads-api.service';
import type { MyLeadsQuery } from '../models/my-leads-query.interface';

const TABS = ['new', 'assigned', 'self_sourced', 'follow_ups_due', 'nurture'] as const;
type Tab = (typeof TABS)[number];

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

/** LEAD-12 "My Leads": New / Assigned / Self-sourced / Follow-ups due / Nurture, sorted by SLA urgency. */
@Component({
  selector: 'app-leads-mine-page',
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
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
  ],
  templateUrl: './leads-mine.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class LeadsMinePage {
  private readonly leads = inject(LeadsApi);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);

  readonly tab = input<Tab>('assigned');
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });

  protected readonly tabs = TABS;
  protected readonly formatPhone = formatPhone;

  protected readonly result = rxResource({
    params: (): MyLeadsQuery => ({ tab: TABS.includes(this.tab()) ? this.tab() : 'assigned', page: this.page() }),
    stream: ({ params }) => this.leads.mine(params),
  });

  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));

  protected overdueDate(value: string | null | undefined): boolean {
    return isOverdue(value);
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
