import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injector, Service, computed, effect, inject, runInInjectionContext, signal, untracked } from '@angular/core';
import { Subject, firstValueFrom, type Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ChatApi } from './chat-api.service';
import { ChatCommands } from './chat-commands.service';
import { CHAT_EVENTS, type ChatMessage, type ChatStatus, type ChatSummary, summaryOf } from './chat.models';

/** Delivered reports are gathered this long and sent as one command (a burst of messages is one report). */
const DELIVERED_FLUSH_MS = 400;
/** Conversations per delivered command (the API's limit). */
const DELIVERED_BATCH = 100;

interface MessageEvent {
  chatId: string;
  message: ChatMessage;
}
interface MembersEvent {
  chatId: string;
  userIds: string[];
  memberCount: number;
}
interface UpdatedEvent {
  chatId: string;
  name?: string | null;
  nameAr?: string | null;
  status?: ChatStatus;
  memberCount?: number;
}

/**
 * The signed-in user's conversations and unread counts, kept current by the
 * realtime events (the server sends each only to the conversation's members)
 * — the chat list, the navigation badge and the open conversation all read
 * this one state. Loaded from the API; after a reconnect it is read again
 * (whatever was missed while offline comes from the database, never from a
 * replay of events). Listeners are registered once, for the whole session.
 *
 * Delivered is reported for this device when a message really reached it —
 * over the realtime connection, in a batch of history, or as the list's
 * latest positions once the list is loaded — in every kind of conversation,
 * gathered and sent in one command. The server keeps only the furthest
 * position, so a report can never move anyone backwards or mark anyone else.
 */
@Service()
export class ChatStore {
  private readonly api = inject(ChatApi);
  private readonly commands = inject(ChatCommands);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private listening = false;
  /** Positions waiting to be reported delivered, and the furthest already reported, per conversation. */
  private readonly deliveredQueue = new Map<string, number>();
  private readonly deliveredSent = new Map<string, number>();
  private deliveredTimer: ReturnType<typeof setTimeout> | undefined;

  readonly chats = signal<ChatSummary[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  /** The conversation on screen — its new messages count as read while the page is visible. */
  readonly activeChatId = signal<string | null>(null);
  private readonly countedUnread = signal(0);
  /** The active list and the archive (each most recent first). */
  readonly activeChats = computed(() => this.chats().filter((chat) => !chat.archived));
  readonly archivedChats = computed(() => this.chats().filter((chat) => chat.archived));
  /** Unread messages over every conversation (the navigation badge). */
  readonly unreadTotal = computed(() => (this.loaded() ? this.chats().reduce((sum, chat) => sum + chat.unreadCount, 0) : this.countedUnread()));
  /** A conversation this user lost (removed from it, or deleted) — the open conversation closes. */
  readonly removed$ = new Subject<string>();

  /** Starts following the realtime events (once per session). */
  listen(): void {
    if (this.listening) return;
    this.listening = true;
    runInInjectionContext(this.injector, () => {
      const subscriptions: Subscription[] = [
        this.commands.on<MessageEvent>(CHAT_EVENTS.message).subscribe((event) => this.onMessage(event)),
        this.commands.on<MessageEvent>(CHAT_EVENTS.messageUpdated).subscribe((event) => this.onEdited(event)),
        this.commands.on<MembersEvent>(CHAT_EVENTS.memberAdded).subscribe((event) => this.onMembers(event, true)),
        this.commands.on<MembersEvent>(CHAT_EVENTS.memberRemoved).subscribe((event) => this.onMembers(event, false)),
        this.commands.on<UpdatedEvent>(CHAT_EVENTS.updated).subscribe((event) => this.patch(event.chatId, { ...event, chatId: undefined } as Partial<ChatSummary>)),
        this.commands.on<{ chatId: string; locked: boolean }>(CHAT_EVENTS.locked).subscribe((event) => void this.refreshChat(event.chatId)),
        this.commands.on<{ chatId: string; adminOnly: boolean }>(CHAT_EVENTS.adminModeChanged).subscribe((event) => void this.refreshChat(event.chatId)),
        this.commands.on<{ chatId: string; userId: string }>(CHAT_EVENTS.memberRoleChanged).subscribe((event) => {
          if (event.userId === this.auth.user()?.id) void this.refreshChat(event.chatId);
        }),
        this.commands.on<{ chatId: string }>(CHAT_EVENTS.deleted).subscribe((event) => this.remove(event.chatId)),
        // Archived / unarchived on another of this user's devices.
        this.commands.on<{ chatId: string; archived: boolean }>(CHAT_EVENTS.archived).subscribe((event) => this.patch(event.chatId, { archived: event.archived })),
      ];
      inject(DestroyRef).onDestroy(() => subscriptions.forEach((subscription) => subscription.unsubscribe()));
      // Signed in: the badge's count; signed out: nothing kept. Each reconnection reads everything again.
      effect(() => {
        const user = this.auth.user();
        untracked(() => (user ? void this.loadUnreadCount() : this.reset()));
      });
      effect(() => {
        if (this.commands.connections() > 1) untracked(() => void (this.loaded() ? this.load() : this.loadUnreadCount()));
      });
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const chats = await firstValueFrom(this.api.list());
      this.chats.set(chats);
      this.loaded.set(true);
      this.error.set(null);
      // The list's latest positions are on this device now.
      for (const chat of chats) if (chat.lastSeq > chat.lastDeliveredSeq) this.reportDelivered(chat.id, chat.lastSeq);
    } catch (error) {
      this.error.set(error);
    } finally {
      this.loading.set(false);
    }
  }

  find(chatId: string): ChatSummary | undefined {
    return this.chats().find((chat) => chat.id === chatId);
  }

  /**
   * Puts (or replaces) a conversation, most recent activity first. Positions
   * never go backwards: an answer read before the latest message or read
   * receipt (a details request racing the realtime events) cannot bring back
   * an unread count or an older last message.
   */
  upsert(summary: ChatSummary): void {
    const known = this.find(summary.id);
    const lastSeq = Math.max(summary.lastSeq, known?.lastSeq ?? 0);
    const lastReadSeq = Math.min(lastSeq, Math.max(summary.lastReadSeq, known?.lastReadSeq ?? 0));
    const lastDeliveredSeq = Math.min(lastSeq, Math.max(summary.lastDeliveredSeq ?? 0, known?.lastDeliveredSeq ?? 0, lastReadSeq));
    const newer = !!known && known.lastSeq > summary.lastSeq;
    const merged: ChatSummary = {
      ...summary,
      lastSeq,
      lastReadSeq,
      lastDeliveredSeq,
      unreadCount: Math.max(0, lastSeq - lastReadSeq),
      lastMessage: newer ? known.lastMessage : summary.lastMessage,
      lastMessageAt: newer ? known.lastMessageAt : summary.lastMessageAt,
    };
    this.chats.update((chats) => sortByActivity([merged, ...chats.filter((chat) => chat.id !== summary.id)]));
  }

  /** Archives / unarchives in this user's list: stored on the server first, then shown (its answer is the truth). */
  async setArchived(chatId: string, archived: boolean): Promise<void> {
    this.upsert(summaryOf(await firstValueFrom(this.api.setArchived(chatId, archived))));
  }

  /** Reads one conversation again (a new one, a changed lock, role or mode). */
  async refreshChat(chatId: string): Promise<void> {
    try {
      this.upsert(summaryOf(await firstValueFrom(this.api.details(chatId))));
    } catch {
      // Not (or no longer) a member: the API answered 404.
      this.remove(chatId);
    }
  }

  /** Read up to `seq`: the badge goes down at once; the server is told (its answer only confirms). */
  markRead(chatId: string, seq: number): void {
    const chat = this.find(chatId);
    if (!chat || seq <= chat.lastReadSeq) return;
    this.patch(chatId, { lastReadSeq: seq, lastDeliveredSeq: Math.max(chat.lastDeliveredSeq ?? 0, seq), unreadCount: Math.max(0, chat.lastSeq - seq) });
    // Seen is delivered too (the server moves both).
    this.deliveredSent.set(chatId, Math.max(this.deliveredSent.get(chatId) ?? 0, seq));
    void this.commands.markRead(chatId, seq).catch(() => undefined);
  }

  /** This device has the conversation's messages up to `seq`: reported (gathered with others) unless already reported. */
  reportDelivered(chatId: string, seq: number): void {
    if (seq <= Math.max(this.deliveredSent.get(chatId) ?? 0, this.deliveredQueue.get(chatId) ?? 0)) return;
    this.deliveredQueue.set(chatId, seq);
    this.deliveredTimer ??= setTimeout(() => this.flushDelivered(), DELIVERED_FLUSH_MS);
  }

  private flushDelivered(): void {
    this.deliveredTimer = undefined;
    const items = [...this.deliveredQueue].map(([chatId, seq]) => ({ chatId, seq }));
    this.deliveredQueue.clear();
    for (const { chatId, seq } of items) {
      this.deliveredSent.set(chatId, Math.max(this.deliveredSent.get(chatId) ?? 0, seq));
      const chat = this.find(chatId);
      if (chat && seq > (chat.lastDeliveredSeq ?? 0)) this.patch(chatId, { lastDeliveredSeq: seq });
    }
    for (let start = 0; start < items.length; start += DELIVERED_BATCH)
      void this.commands.markDeliveredMany(items.slice(start, start + DELIVERED_BATCH)).catch(() => undefined);
  }

  private onMessage({ chatId, message }: MessageEvent): void {
    const mine = message.sender?.id === this.auth.user()?.id;
    // It reached this device: delivered (every kind of conversation, listed here yet or not).
    if (!mine) this.reportDelivered(chatId, message.seq);
    const chat = this.find(chatId);
    if (!chat) {
      // A conversation new to this list (someone's first private message): read it.
      void this.refreshChat(chatId);
      return;
    }
    if (message.seq <= chat.lastSeq && chat.lastMessage?.id === message.id) return;
    const watching = this.activeChatId() === chatId && this.document.visibilityState === 'visible';
    const lastSeq = Math.max(chat.lastSeq, message.seq);
    const lastReadSeq = mine || watching ? lastSeq : chat.lastReadSeq;
    this.upsert({
      ...chat,
      lastSeq,
      lastReadSeq,
      unreadCount: Math.max(0, lastSeq - lastReadSeq),
      lastMessageAt: message.createdAt,
      lastMessage: { id: message.id, seq: message.seq, senderId: message.sender?.id ?? '', preview: message.text?.slice(0, 140) ?? null, deleted: message.deleted, unavailable: message.unavailable, createdAt: message.createdAt },
    });
  }

  /** A message its sender edited: the list's preview follows when it is the last one. */
  private onEdited({ chatId, message }: MessageEvent): void {
    const chat = this.find(chatId);
    if (!chat?.lastMessage || chat.lastMessage.id !== message.id) return;
    this.patch(chatId, { lastMessage: { ...chat.lastMessage, preview: message.text?.slice(0, 140) ?? null, deleted: message.deleted, unavailable: message.unavailable } });
  }

  private onMembers(event: MembersEvent, added: boolean): void {
    const me = this.auth.user()?.id;
    if (me && event.userIds.includes(me)) {
      if (added) void this.refreshChat(event.chatId);
      else this.remove(event.chatId);
      return;
    }
    this.patch(event.chatId, { memberCount: event.memberCount });
  }

  private patch(chatId: string, changes: Partial<ChatSummary>): void {
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as Partial<ChatSummary>;
    this.chats.update((chats) => chats.map((chat) => (chat.id === chatId ? { ...chat, ...defined } : chat)));
  }

  private remove(chatId: string): void {
    this.chats.update((chats) => chats.filter((chat) => chat.id !== chatId));
    this.removed$.next(chatId);
  }

  private async loadUnreadCount(): Promise<void> {
    try {
      this.countedUnread.set((await firstValueFrom(this.api.unreadCount())).count);
    } catch {
      // The badge is a hint; the list shows the truth when opened.
    }
  }

  private reset(): void {
    this.chats.set([]);
    this.loaded.set(false);
    this.countedUnread.set(0);
    this.activeChatId.set(null);
    clearTimeout(this.deliveredTimer);
    this.deliveredTimer = undefined;
    this.deliveredQueue.clear();
    this.deliveredSent.clear();
  }
}

function sortByActivity(chats: ChatSummary[]): ChatSummary[] {
  const at = (chat: ChatSummary) => (chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : 0);
  return [...chats].sort((a, b) => at(b) - at(a));
}
