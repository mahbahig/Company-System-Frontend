import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Lock, LockOpen, MessagesSquare, ShieldCheck, Trash2 } from 'lucide';

import { ChatApi } from '../../../core/chat/chat-api.service';
import type { ChatMember, ChatStatus, ChatType, ManagedChat, ManagedChatDetails } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { FilterDefinition } from '../../../shared/crm/list-toolbar/filter-definition.interface';
import { ListToolbarComponent } from '../../../shared/crm/list-toolbar/list-toolbar.component';
import { DEFAULT_PAGE_SIZE, pageSizeAttribute } from '../../../shared/crm/pagination/page-size';
import { PageSizeSelectComponent } from '../../../shared/crm/pagination/page-size-select.component';
import { PaginationComponent } from '../../../shared/crm/pagination/pagination.component';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { DialogComponent } from '../../../shared/ui/dialog/dialog.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SkeletonRowComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { TABLE_IMPORTS } from '../../../shared/ui/table/table.imports';
import { ActionRunner } from '../../../shared/utils/action-runner';

const TYPES: readonly ChatType[] = ['public', 'team', 'group'];
const STATUSES: readonly ChatStatus[] = ['active', 'inactive'];

/**
 * Group chat management (Super Administrators): every group conversation —
 * the company chat, team chats, custom groups — with its members, admins
 * and settings, searched and paged on the server. Custom groups and team
 * chats can be locked, unlocked or deleted; the company chat and private
 * conversations cannot (private ones are never listed). Message content is
 * not here and cannot be opened from here: the API has no such route for
 * management.
 */
@Component({
  selector: 'app-chat-groups-admin-page',
  imports: [TranslatePipe, ListToolbarComponent, PageSizeSelectComponent, PaginationComponent, AlertComponent, AvatarComponent, BadgeComponent, ButtonDirective, DialogComponent, IconComponent, PageHeaderComponent, SkeletonRowComponent, ...TABLE_IMPORTS],
  templateUrl: './chat-groups-admin.page.html',
  host: { class: 'flex flex-col gap-6' },
})
export class ChatGroupsAdminPage {
  private readonly api = inject(ChatApi);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly actions = new ActionRunner(this.i18n);

  readonly q = input<string>();
  readonly type = input<string>();
  readonly status = input<string>();
  readonly page = input(1, { transform: (value: unknown) => numberAttribute(value, 1) });
  readonly pageSize = input(DEFAULT_PAGE_SIZE, { transform: pageSizeAttribute });

  protected readonly icons = { empty: MessagesSquare, lock: Lock, unlock: LockOpen, remove: Trash2, admin: ShieldCheck };
  protected readonly result = rxResource({
    params: () => ({
      q: this.q() || undefined,
      type: TYPES.find((value) => value === this.type()),
      status: STATUSES.find((value) => value === this.status()),
      page: this.page(),
      pageSize: this.pageSize(),
    }),
    stream: ({ params }) => this.api.managedList(params),
  });
  protected readonly rows = computed(() => (this.result.hasValue() ? this.result.value().rows : []));
  protected readonly filtered = computed(() => !!(this.q() || this.type() || this.status()));
  protected readonly filters = computed<FilterDefinition[]>(() => [
    { name: 'type', label: this.i18n.t('admin.chats.columns.type'), options: TYPES.map((value) => ({ value, label: this.i18n.t(`chat.types.${value}`) })), value: this.type() ?? '' },
    { name: 'status', label: this.i18n.t('admin.chats.columns.status'), options: STATUSES.map((value) => ({ value, label: this.i18n.t(`admin.chats.status.${value}`) })), value: this.status() ?? '' },
  ]);
  protected readonly viewing = signal(false);
  protected readonly details = signal<ManagedChatDetails | null>(null);
  protected readonly detailsError = signal<unknown>(null);

  protected name(chat: Pick<ManagedChat, 'type' | 'name' | 'nameAr'>): string {
    if (chat.type === 'public') return this.i18n.t('chat.companyChat');
    return this.i18n.pick(chat.nameAr, chat.name) || '—';
  }

  protected person(member: ChatMember): string {
    return this.i18n.pick(member.nameAr, member.nameEn);
  }

  protected creator(chat: ManagedChat): string {
    return chat.createdBy ? this.i18n.pick(chat.createdBy.nameAr, chat.createdBy.nameEn) : this.i18n.t('admin.chats.system');
  }

  protected async view(chat: ManagedChat): Promise<void> {
    this.details.set(null);
    this.detailsError.set(null);
    this.viewing.set(true);
    try {
      this.details.set(await firstValueFrom(this.api.managedDetails(chat.id)));
    } catch (error) {
      this.detailsError.set(error);
    }
  }

  protected async setLocked(chat: ManagedChat, locked: boolean): Promise<void> {
    const name = this.name(chat);
    await this.confirm.confirm({
      heading: this.i18n.t(locked ? 'admin.chats.lockTitle' : 'admin.chats.unlockTitle', { name }),
      message: this.i18n.t(locked ? 'admin.chats.lockBody' : 'admin.chats.unlockBody'),
      details: locked ? [this.i18n.t('admin.chats.lockDetailRead'), this.i18n.t('admin.chats.lockDetailNotify')] : undefined,
      confirmLabel: this.i18n.t(locked ? 'admin.chats.lock' : 'admin.chats.unlock'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      variant: locked ? 'warning' : 'default',
      action: async () => {
        const updated = await firstValueFrom(this.api.setLocked(chat.id, locked));
        if (this.details()?.id === chat.id) this.details.set(updated);
        this.actions.message.set(this.i18n.t(locked ? 'admin.chats.locked' : 'admin.chats.unlocked', { name }));
        this.result.reload();
      },
    });
  }

  protected async remove(chat: ManagedChat): Promise<void> {
    const name = this.name(chat);
    await this.confirm.confirm({
      heading: this.i18n.t('admin.chats.deleteTitle', { name }),
      message: this.i18n.t('admin.chats.deleteBody'),
      details: [this.i18n.t('admin.chats.deleteDetailMembers', { count: chat.memberCount }), this.i18n.t('admin.chats.deleteDetailMessages')],
      irreversible: true,
      confirmLabel: this.i18n.t('admin.chats.delete'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      variant: 'danger',
      requireText: this.i18n.t('admin.chats.deleteWord'),
      action: async () => {
        await firstValueFrom(this.api.deleteManaged(chat.id));
        if (this.details()?.id === chat.id) this.viewing.set(false);
        this.actions.message.set(this.i18n.t('admin.chats.deleted', { name }));
        this.result.reload();
      },
    });
  }
}
