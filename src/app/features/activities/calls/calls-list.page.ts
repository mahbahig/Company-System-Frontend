import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ReferenceDataService } from '../../../core/reference/reference-data.service';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { EnumLabelPipe } from '../../../shared/crm/status-badge/enum-label.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { asUserRef, userName } from '../../../shared/utils/display-name';
import { formatPhone } from '../../../shared/utils/format';
import { ActivitiesApi, refLabel, type Call } from '../activities-api.service';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';

/** E11 call log. */
@Component({
  selector: 'app-calls-list-page',
  imports: [AvatarComponent, ShortcutDirective, SkeletonRowComponent, RouterLink, TranslatePipe, EnumLabelPipe, AlertComponent, ButtonDirective, PageHeaderComponent, ListToolbarComponent, PaginationComponent, ...TABLE_IMPORTS, CreateIconComponent],
  templateUrl: './calls-list.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class CallsListPage {
  private readonly api = inject(ActivitiesApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly reference = inject(ReferenceDataService);
  protected readonly formatPhone = formatPhone;

  readonly q = input<string>();
  readonly direction = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly result = rxResource({ params: () => ({ q: this.q(), direction: this.direction(), page: this.page(), pageSize: this.pageSize() }), stream: ({ params }) => this.api.calls(params) });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'direction', label: this.i18n.t('act.columns.direction'), options: ['inbound', 'outbound'].map((value) => ({ value, label: this.i18n.t(`enums.callDirection.${value}`) })), value: this.direction() ?? '' },
  ]);

  constructor() {
    void this.reference.load();
  }

  protected withWhom(row: Call): string {
    const pick = (ar?: string | null, en?: string | null) => this.i18n.pick(ar, en);
    return refLabel(pick, row.customerId) || refLabel(pick, row.leadId) || refLabel(pick, row.opportunityId) || '—';
  }

  protected owner(row: Call): string {
    return userName((ar, en) => this.i18n.pick(ar, en), row.ownerId);
  }

  /** The owner as a reference (for their picture). */
  protected ownerRef(row: Call) {
    return asUserRef(row.ownerId);
  }
}
