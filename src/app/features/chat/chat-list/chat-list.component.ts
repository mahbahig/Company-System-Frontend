import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Search } from 'lucide';

import { AuthService } from '../../../core/auth/auth.service';
import { isSuperAdministrator } from '../../../core/auth/super-administrator';
import { ChatStore } from '../../../core/chat/chat-store.service';
import type { ChatSummary } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { CreateIconComponent } from '../../../shared/ui/create-icon/create-icon.component';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { CHAT_ICONS, CHAT_TYPE_ICON, chatTitle, lastMessagePreview } from '../shared/chat-display';

/**
 * The reader's conversations, most recent first, each with its unread count
 * and last message — from `ChatStore` (kept live by the realtime events).
 * The filter only narrows this list (the conversations themselves); message
 * search is inside each conversation, on the server.
 */
@Component({
  selector: 'app-chat-list',
  imports: [RouterLink, TranslatePipe, AlertComponent, AvatarComponent, ButtonDirective, CreateIconComponent, IconComponent, InputDirective],
  templateUrl: './chat-list.component.html',
  host: { class: 'flex min-h-0 flex-col' },
})
export class ChatListComponent {
  protected readonly store = inject(ChatStore);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly activeId = input<string | null>(null);
  /** "+ New message" / "+ New group". */
  readonly newChat = output<void>();
  readonly newGroup = output<void>();

  protected readonly icons = { search: Search, ...CHAT_ICONS };
  protected readonly typeIcon = CHAT_TYPE_ICON;
  protected readonly filter = signal('');
  /** Only employees who may be in groups can start one (the API decides; this hides what would be refused). */
  protected readonly canCreateGroups = computed(() => !!this.auth.user() && !isSuperAdministrator(this.auth.user()!));
  protected readonly visible = computed(() => {
    const term = this.filter().trim().toLocaleLowerCase();
    return term ? this.store.chats().filter((chat) => this.title(chat).toLocaleLowerCase().includes(term)) : this.store.chats();
  });

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
