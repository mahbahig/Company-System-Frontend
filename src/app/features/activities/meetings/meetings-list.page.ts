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
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

const STATUSES = ['planned', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'];

/** E12 meetings. */
@Component({
  selector: 'app-meetings-list-page',
  imports: [ShortcutDirective, SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, StatusBadgeComponent, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, CreateIconComponent, PageSizeSelectComponent],
  templateUrl: './meetings-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class MeetingsListPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly result = rxResource({ params: () => ({ q: this.q(), status: this.status(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.meetings(params) });
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
