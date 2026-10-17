import { Component, computed, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LifeBuoy, MessageSquare, Paperclip } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ShortcutDirective } from '../../../core/shortcuts/shortcut.directive';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import type { SupportTicketStatus } from '../models/support-ticket.interface';
import { SUPPORT_STATUS_TONE, SUPPORT_STATUSES } from '../shared/support-display';
import { SupportSeverityBadgeComponent } from '../shared/support-severity-badge.component';
import { SupportApi } from '../support-api.service';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

/**
 * Help & Support for every employee: their own tickets (the API never returns
 * anyone else's), with search, a status filter and paging, and the way to
 * report a new problem.
 */
@Component({
  selector: 'app-support-tickets-page',
  imports: [RouterLink, TranslatePipe, ShortcutDirective, ListToolbarComponent, PaginationComponent, AlertComponent, BadgeComponent, ButtonDirective, IconComponent, PageHeaderComponent, SkeletonRowComponent, SupportSeverityBadgeComponent, ...TABLE_IMPORTS, CreateIconComponent, PageSizeSelectComponent],
  templateUrl: './support-tickets.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SupportTicketsPage {
  private readonly api = inject(SupportApi);
  protected readonly i18n = inject(I18nService);

  readonly q = input<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly icons = { help: LifeBuoy, comments: MessageSquare, attachments: Paperclip };
  protected readonly tone = SUPPORT_STATUS_TONE;

  protected readonly result = rxResource({
    params: () => ({ q: this.q(), status: (this.status() as SupportTicketStatus) || undefined, page: this.page(), pageSize: this.pageSize() }),
    stream: ({ params }) => this.api.mine(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filtered = computed(() => !!(this.q() || this.status()));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    {
      name: 'status',
      label: this.i18n.t('support.columns.status'),
      options: SUPPORT_STATUSES.map((value) => ({ value, label: this.i18n.t(`support.status.${value}`) })),
      value: this.status() ?? '',
    },
  ]);
}
