import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Archive, ArchiveRestore, ArrowLeft, EllipsisVertical, Search } from 'lucide';
import { defer } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { isSuperAdministrator } from '../../../core/auth/super-administrator';
import { ChatStore } from '../../../core/chat/chat-store.service';
import type { ChatSummary } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { ContextMenuDirective } from '../../../shared/ui/context-menu/context-menu.directive';
import { type ContextMenuItem, ContextMenuService } from '../../../shared/ui/context-menu/context-menu.service';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ActionRunner } from '../../../shared/utils/action-runner';
import { CHAT_ICONS, CHAT_TYPE_ICON, chatTitle, lastMessagePreview } from '../shared/chat-display';

/**
 * The reader's conversations, most recent first, each with its unread count
 * and last message — from `ChatStore` (kept live by the realtime events).
 * The filter only narrows this list (the conversations themselves); message
 * search is inside each conversation, on the server.
 *
 * Each conversation's actions (right-click, long press, or its "⋯" button):
 * Archive / Unarchive — the server's `capabilities` decide, and it stores the
 * change before the list moves. Members never delete a conversation (Super
 * Administrators delete groups in Chat management), so there is no Delete
 * here. Archived conversations live in their own view, history and unread
 * counts untouched.
 */
@Component({
  selector: 'app-chat-list',
  imports: [RouterLink, TranslatePipe, AlertComponent, AvatarComponent, ButtonDirective, ContextMenuDirective, CreateIconComponent, IconComponent, InputDirective],
  templateUrl: './chat-list.component.html',
  host: { class: 'flex min-h-0 flex-col' },
})
export class ChatListComponent {
  protected readonly store = inject(ChatStore);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly menu = inject(ContextMenuService);
  protected readonly actions = new ActionRunner(inject(I18nService));

  readonly activeId = input<string | null>(null);
  /** "+ New message" / "+ New group". */
  readonly newChat = output<void>();
  readonly newGroup = output<void>();

  protected readonly icons = { search: Search, more: EllipsisVertical, back: ArrowLeft, archive: Archive, ...CHAT_ICONS };
  protected readonly typeIcon = CHAT_TYPE_ICON;
  protected readonly filter = signal('');
  /** Showing the archive instead of the active list. */
  protected readonly showArchived = signal(false);
  protected readonly archivedUnread = computed(() => this.store.archivedChats().reduce((sum, chat) => sum + chat.unreadCount, 0));
  /** Only employees who may be in groups can start one (the API decides; this hides what would be refused). */
  protected readonly canCreateGroups = computed(() => !!this.auth.user() && !isSuperAdministrator(this.auth.user()!));
  protected readonly visible = computed(() => {
    const term = this.filter().trim().toLocaleLowerCase();
    const chats = this.showArchived() ? this.store.archivedChats() : this.store.activeChats();
    return term ? chats.filter((chat) => this.title(chat).toLocaleLowerCase().includes(term)) : chats;
  });

  /** What the reader may do with a conversation — only what the server allows (`capabilities`). */
  protected chatActions(chat: ChatSummary): ContextMenuItem[] {
    if (!chat.capabilities.archive) return [];
    return chat.archived
      ? [{ id: 'unarchive', label: this.i18n.t('chat.unarchive'), icon: ArchiveRestore, run: () => void this.setArchived(chat, false) }]
      : [{ id: 'archive', label: this.i18n.t('chat.archive'), icon: Archive, run: () => void this.setArchived(chat, true) }];
  }

  /** The "⋯" button: the same actions, for touch screens and the keyboard. */
  protected openActions(chat: ChatSummary, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menu.toggleFrom(this.chatActions(chat), event.currentTarget as HTMLElement, this.i18n.t('chat.conversationActions', { name: this.title(chat) }));
  }

  protected async setArchived(chat: ChatSummary, archived: boolean): Promise<void> {
    await this.actions.run(defer(() => this.store.setArchived(chat.id, archived)), null);
    // Leave an emptied archive view.
    if (!archived && this.showArchived() && !this.store.archivedChats().length) this.showArchived.set(false);
  }

  protected title(chat: ChatSummary): string {
    return chatTitle(chat, this.i18n);
  }

  protected preview(chat: ChatSummary): string {
    return lastMessagePreview(chat, this.auth.user()?.id ?? null, this.i18n);
  }

  protected when(chat: ChatSummary): string {
    if (!chat.lastMessageAt) return '';
    return this.i18n.dayKey(chat.lastMessageAt) === this.i18n.dayKey(new Date()) ? this.i18n.formatTime(chat.lastMessageAt) : this.i18n.formatDate(chat.lastMessageAt);
  }
}
