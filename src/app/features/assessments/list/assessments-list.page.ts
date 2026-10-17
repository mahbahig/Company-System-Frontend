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
import { userName } from '../../../shared/utils/display-name';
import { AssessmentsApi, type Assessment } from '../assessments-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

/** §11.4/11.5 engineer assignments and the Technical Lead review queue. */
@Component({
  selector: 'app-assessments-list-page',
  imports: [SkeletonRowComponent, RouterLink, TranslatePipe, StatusBadgeComponent, AlertComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, PageSizeSelectComponent],
  templateUrl: './assessments-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class AssessmentsListPage {
  private readonly api = inject(AssessmentsApi);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly mine = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: this.status(), mine: this.mine() === '1' || undefined, page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'status', label: this.i18n.t('crm.assessments.columns.status'), options: ['draft', 'submitted', 'approved', 'returned'].map((value) => ({ value, label: this.i18n.t(`enums.assessmentStatus.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly toggles = computed<ToggleDefinition[]>(() => [{ name: 'mine', label: this.i18n.t('crm.filters.onlyMine'), checked: this.mine() === '1' }]);

  protected ref(value: Assessment['opportunityId'], key: 'name' | 'opportunityNo'): string {
    return typeof value === 'object' ? value[key] : '—';
  }

  protected customer(row: Assessment): string {
    return typeof row.customerId === 'object' ? this.i18n.pick(row.customerId.nameAr, row.customerId.nameEn) : '—';
  }

  protected name(value: Assessment['engineerId']): string {
    return userName((ar, en) => this.i18n.pick(ar, en), value);
  }
}
