import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Inbox, MessageSquare, Paperclip, Trash2 } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { FORM_IMPORTS } from '../../../shared/ui/form/form.imports';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';
import type { SupportTicket } from '../models/support-ticket.interface';
import { AWAITING_DESK_STATUS, SUPPORT_SEVERITIES, SUPPORT_STATUS_TONE, SUPPORT_STATUSES, takeNotice } from '../shared/support-display';
import { SupportSeverityBadgeComponent } from '../shared/support-severity-badge.component';
import { SupportApi } from '../support-api.service';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';

/** The words the API requires before it deletes every ticket. */
export const DELETE_ALL_PHRASE = 'DELETE ALL';

/**
 * The support desk (System Administrator): every employee's ticket, searched
 * by title, number, the employee's name or e-mail in one box, filtered by
 * status and severity, paged on the server (`?status=pending,reopened&severity=critical`
 * is the dashboard's and the Exceptions Center's link to new critical tickets). Deleting everything takes the typed phrase —
 * here and in the API.
 */
@Component({
  selector: 'app-support-tickets-admin-page',
  imports: [AvatarComponent, RouterLink, TranslatePipe, ListToolbarComponent, PaginationComponent, AlertComponent, BadgeComponent, ButtonDirective, DialogComponent, IconComponent, PageHeaderComponent, SkeletonRowComponent, SupportSeverityBadgeComponent, ...FORM_IMPORTS, ...TABLE_IMPORTS, PageSizeSelectComponent],
  templateUrl: './support-tickets-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class SupportTicketsAdminPage {
  private readonly api = inject(SupportApi);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly q = input<string>();
  readonly status = input<string>();
  /** `?severity=critical` (the Exceptions Center's and the dashboard's link) — filtered by the API. */
  readonly severity = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  /** `?pageSize=` (10 / 20 / 50 / 100; default 20). */
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly icons = { empty: Inbox, comments: MessageSquare, attachments: Paperclip, remove: Trash2 };
  protected readonly tone = SUPPORT_STATUS_TONE;
  protected readonly phrase = DELETE_ALL_PHRASE;
  protected readonly notice = signal<string | null>(takeNotice());
  protected readonly confirming = signal(false);
  protected readonly typed = signal('');
  protected readonly phraseMatches = computed(() => this.typed().trim() === DELETE_ALL_PHRASE);

  protected readonly result = rxResource({
    params: () => ({
      q: this.q(),
      status: SUPPORT_STATUSES.find((value) => value === this.status()),
      severity: SUPPORT_SEVERITIES.find((value) => value === this.severity()),
      page: this.page(), pageSize: this.pageSize(),
    }),
    stream: ({ params }) => this.api.all(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filtered = computed(() => !!(this.q() || this.status() || this.severity()));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    {
      name: 'status',
      label: this.i18n.t('support.columns.status'),
      // "Waiting for the support desk" (new and reopened) is what the dashboard's "New tickets" opens.
      options: [{ value: AWAITING_DESK_STATUS, label: this.i18n.t('support.status.awaiting') }, ...SUPPORT_STATUSES.map((value) => ({ value, label: this.i18n.t(`support.status.${value}`) }))],
      value: this.status() ?? '',
    },
    {
      name: 'severity',
      label: this.i18n.t('support.columns.severity'),
      options: SUPPORT_SEVERITIES.map((value) => ({ value, label: this.i18n.t(`support.severity.${value}`) })),
      value: this.severity() ?? '',
    },
  ]);

  protected employee(row: SupportTicket): string {
    return this.i18n.pick(row.requesterNameAr, row.requesterNameEn);
  }

  protected askDeleteAll(): void {
    this.typed.set('');
    this.confirming.set(true);
  }

  protected async deleteAll(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.phraseMatches() || this.actions.busy()) return;
    this.notice.set(null);
    const result = await this.actions.run(this.api.removeAll(DELETE_ALL_PHRASE), null, () => {
      this.confirming.set(false);
      this.result.reload();
    });
    if (result) this.actions.message.set(this.i18n.t('support.notices.allDeleted', { count: result.deletedTickets }));
  }
}
