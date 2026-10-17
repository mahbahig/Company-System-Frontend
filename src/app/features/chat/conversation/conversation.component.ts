import { DestroyRef, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, Info, Lock, Search } from 'lucide';
import { firstValueFrom, type Subscription } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ChatApi } from '../../../core/chat/chat-api.service';
import { ChatCommands } from '../../../core/chat/chat-commands.service';
import { ChatStore } from '../../../core/chat/chat-store.service';
import { CHAT_EVENTS, type ChatDetails, type ChatMessage, type ChatReceipt, summaryOf } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { CHAT_TYPE_ICON, chatTitle } from '../shared/chat-display';
import { ChatDetailsPanelComponent } from './chat-details-panel.component';
import { ChatSearchPanelComponent } from './chat-search-panel.component';
import { ChatComposerComponent } from './composer.component';
import { ConversationStore, type PendingMessage } from './conversation.store';
import { MessageListComponent } from './message-list.component';

/** "X is typing" fades if no new signal comes within this long. */
const TYPING_TTL_MS = 6_000;

/**
 * One open conversation: its header, history (`MessageListComponent`, batches
 * only), composer, in-conversation search and details. Its realtime events
 * (new and deleted messages, typing, receipts, locks and mode changes) come
 * over the application's one connection; the subscriptions live and die
 * with this component. After a reconnect what was missed is read from the
 * API. Losing the conversation (removed, deleted) closes it.
 */
@Component({
  selector: 'app-conversation',
  imports: [RouterLink, TranslatePipe, AlertComponent, AvatarComponent, ButtonDirective, IconComponent, ChatComposerComponent, ChatDetailsPanelComponent, ChatSearchPanelComponent, MessageListComponent],
  providers: [ConversationStore],
  templateUrl: './conversation.component.html',
  host: { class: 'relative flex min-h-0 min-w-0 flex-1' },
})
export class ConversationComponent {
  protected readonly store = inject(ConversationStore);
  private readonly chats = inject(ChatStore);
  private readonly commands = inject(ChatCommands);
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  private readonly composer = viewChild(ChatComposerComponent);
  private readonly searchPanel = viewChild(ChatSearchPanelComponent);

  readonly chatId = input.required<string>();

  protected readonly icons = { back: ArrowLeft, search: Search, info: Info, lock: Lock };
  protected readonly typeIcon = CHAT_TYPE_ICON;
  protected readonly details = signal<ChatDetails | null>(null);
  protected readonly detailsError = signal<unknown>(null);
  protected readonly panel = signal<'search' | 'details' | null>(null);
  /** One of the user's own messages being edited in the composer, and why the last save failed. */
  protected readonly editing = signal<ChatMessage | null>(null);
  protected readonly editError = signal<string | null>(null);
  private readonly typists = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly summary = computed(() => this.chats.find(this.chatId()) ?? this.details());
  protected readonly title = computed(() => {
    const chat = this.summary();
    return chat ? chatTitle(chat, this.i18n) : '';
  });
  protected readonly subtitle = computed(() => {
    const chat = this.summary();
    if (!chat) return '';
    if (chat.type === 'private') return chat.peer ? this.i18n.pick(chat.peer.jobTitleAr, chat.peer.jobTitleEn) : '';
    return this.i18n.t('chat.memberCount', { count: chat.memberCount });
  });
  protected readonly typingText = computed(() => {
    const names = [...this.typists().keys()].map((id) => this.memberName(id)).filter(Boolean);
    if (!names.length) return '';
    return names.length === 1 ? this.i18n.t('chat.typingOne', { name: names[0] }) : this.i18n.t('chat.typingMany', { count: names.length });
  });
  /** Why this member cannot send now (an i18n key), or null. */
  protected readonly blockedReason = computed(() => {
    const chat = this.summary();
    if (!chat) return null;
    if (chat.locked) return 'chat.lockedNotice';
    if (chat.status === 'inactive') return 'chat.inactiveNotice';
    if (chat.adminOnly && chat.myRole !== 'admin') return 'chat.adminOnlyNotice';
    return chat.capabilities.send ? null : 'chat.cannotSend';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Opening (or switching to) a conversation: its latest batch and its details.
    effect(() => {
      const chatId = this.chatId();
      untracked(() => {
        this.chats.activeChatId.set(chatId);
        this.panel.set(null);
        this.editing.set(null);
        this.typists.set(new Map());
        void this.store.open(chatId);
        void this.loadDetails(chatId);
      });
    });
    // Reconnected: what came while offline, from the API.
    effect(() => {
      if (this.commands.connections() > 1)
        untracked(() => {
          void this.store.catchUp();
          void this.loadDetails(this.chatId());
        });
    });
    const subscriptions: Subscription[] = [
      this.commands.on<{ chatId: string; message: ChatMessage }>(CHAT_EVENTS.message).subscribe(({ chatId, message }) => {
        if (chatId !== this.chatId()) return;
        this.store.receive(message);
        if (message.sender) this.stopTyping(message.sender.id);
      }),
      this.commands.on<{ chatId: string; messageId: string }>(CHAT_EVENTS.messageDeleted).subscribe((event) => {
        if (event.chatId !== this.chatId()) return;
        this.store.markDeleted(event.messageId);
        if (this.editing()?.id === event.messageId) this.editing.set(null);
      }),
      this.commands.on<{ chatId: string; message: ChatMessage }>(CHAT_EVENTS.messageUpdated).subscribe(({ chatId, message }) => {
        if (chatId === this.chatId()) this.store.update(message);
      }),
      this.commands.on<{ chatId: string; userId: string; typing: boolean }>(CHAT_EVENTS.typing).subscribe((event) => {
        if (event.chatId !== this.chatId() || event.userId === this.auth.user()?.id) return;
        if (event.typing) this.typists.update((map) => new Map(map).set(event.userId, Date.now()));
        else this.stopTyping(event.userId);
      }),
      this.commands.on<{ chatId: string } & ChatReceipt>(CHAT_EVENTS.receipt).subscribe(({ chatId, ...receipt }) => {
        const details = this.details();
        if (chatId !== this.chatId() || !details || receipt.userId === this.auth.user()?.id) return;
        this.details.set({ ...details, receipts: mergeReceipt(details.receipts, receipt) });
      }),
      ...[CHAT_EVENTS.locked, CHAT_EVENTS.adminModeChanged, CHAT_EVENTS.memberAdded, CHAT_EVENTS.memberRemoved, CHAT_EVENTS.memberRoleChanged, CHAT_EVENTS.updated].map((event) =>
        this.commands.on<{ chatId: string }>(event).subscribe((data) => {
          if (data.chatId === this.chatId()) void this.loadDetails(data.chatId);
        }),
      ),
      this.chats.removed$.subscribe((chatId) => {
        if (chatId === this.chatId()) void this.router.navigate(['/', 'chat'], { queryParams: { closed: 1 } });
      }),
    ];
    const sweeper = setInterval(() => this.expireTypists(), 2_000);
    destroyRef.onDestroy(() => {
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      clearInterval(sweeper);
      if (this.chats.activeChatId() === this.chatId()) this.chats.activeChatId.set(null);
    });
  }

  protected toggle(panel: 'search' | 'details'): void {
    const next = this.panel() === panel ? null : panel;
    this.panel.set(next);
    if (next === 'search') setTimeout(() => this.searchPanel()?.focus());
  }

  protected closeSearch(): void {
    this.panel.set(null);
    void this.store.jumpToLatest();
    setTimeout(() => this.composer()?.focus());
  }

  protected async openResult(message: ChatMessage): Promise<void> {
    await this.store.jumpTo(message.id);
  }

  protected send(text: string): void {
    void this.store.send(text);
  }

  protected typing(active: boolean): void {
    if (!this.blockedReason()) void this.commands.typing(this.chatId(), active).catch(() => undefined);
  }

  protected read(seq: number): void {
    this.chats.markRead(this.chatId(), seq);
  }

  protected retry(item: PendingMessage): void {
    void this.store.retry(item.clientMessageId);
  }

  protected discard(item: PendingMessage): void {
    this.store.discard(item.clientMessageId);
  }

  protected startEdit(message: ChatMessage): void {
    this.editError.set(null);
    this.editing.set(message);
  }

  protected cancelEdit(): void {
    this.editError.set(null);
    this.editing.set(null);
  }

  /** Saves the edit; the composer keeps the text and says why when the API refuses it. */
  protected async saveEdit(text: string): Promise<void> {
    const message = this.editing();
    if (!message) return;
    try {
      await this.store.editMessage(message.id, text);
      this.editError.set(null);
      this.editing.set(null);
    } catch (error) {
      this.editError.set(this.i18n.errorText(error));
    }
  }

  protected async deleteMessage(message: ChatMessage): Promise<void> {
    await this.confirm.confirm({
      heading: this.i18n.t('chat.deleteTitle'),
      message: this.i18n.t('chat.deleteBody'),
      irreversible: true,
      confirmLabel: this.i18n.t('chat.deleteMessage'),
      cancelLabel: this.i18n.t('common.actions.cancel'),
      variant: 'danger',
      action: () => this.store.deleteMessage(message.id),
    });
  }

  protected detailsChanged(details: ChatDetails): void {
    this.details.set(details);
    this.chats.upsert(summaryOf(details));
  }

  private async loadDetails(chatId: string): Promise<void> {
    try {
      const details = await firstValueFrom(this.api.details(chatId));
      if (chatId !== this.chatId()) return;
      this.detailsChanged(details);
      this.detailsError.set(null);
    } catch (error) {
      if (chatId === this.chatId()) this.detailsError.set(error);
    }
  }

  private memberName(userId: string): string {
    const member = this.details()?.members.find((candidate) => candidate.id === userId);
    return member ? this.i18n.pick(member.nameAr, member.nameEn) : '';
  }

  private stopTyping(userId: string): void {
    if (!this.typists().has(userId)) return;
    this.typists.update((map) => {
      const next = new Map(map);
      next.delete(userId);
      return next;
    });
  }

  private expireTypists(): void {
    const now = Date.now();
    if ([...this.typists().values()].some((at) => now - at > TYPING_TTL_MS)) this.typists.update((map) => new Map([...map].filter(([, at]) => now - at <= TYPING_TTL_MS)));
  }
}

/** A member's newer position replaces theirs; positions never go backwards (a late receipt changes nothing). */
function mergeReceipt(receipts: ChatReceipt[], incoming: ChatReceipt): ChatReceipt[] {
  const known = receipts.find((receipt) => receipt.userId === incoming.userId);
  if (!known) return [...receipts, incoming];
  const merged: ChatReceipt = {
    userId: known.userId,
    deliveredSeq: Math.max(known.deliveredSeq, incoming.deliveredSeq),
    readSeq: Math.max(known.readSeq, incoming.readSeq),
    deliveredAt: incoming.deliveredSeq >= known.deliveredSeq ? incoming.deliveredAt : known.deliveredAt,
    readAt: incoming.readSeq >= known.readSeq ? incoming.readAt : known.readAt,
  };
  return receipts.map((receipt) => (receipt.userId === merged.userId ? merged : receipt));
}
