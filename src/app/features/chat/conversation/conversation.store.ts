import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ChatApi } from '../../../core/chat/chat-api.service';
import { ChatCommands } from '../../../core/chat/chat-commands.service';
import { ChatStore } from '../../../core/chat/chat-store.service';
import type { ChatMessage, ChatMessagePage } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * The most messages one conversation keeps in memory (and in the page): a
 * window over a history of any length. Scrolling further drops the far end,
 * which is read again from the API when scrolled back to.
 */
export const MESSAGE_WINDOW = 300;

/** A message this browser is sending (shown at once, replaced by the stored one when the server acknowledges it). */
export interface PendingMessage {
  clientMessageId: string;
  text: string;
  createdAt: string;
  state: 'sending' | 'failed';
  error: string | null;
}

/**
 * One open conversation's messages — never its whole history. Opens on the
 * latest batch; `loadOlder` / `loadNewer` read one batch before / after what
 * is shown (cursor: the position `seq`); `jumpTo` replaces the window with
 * the batch around one message (a search result far back). The window holds
 * at most {@link MESSAGE_WINDOW} messages: past that the far end is dropped
 * and marked as having more.
 *
 * Every message is placed by its id and ordered by its position, so the
 * same message arriving twice — over Socket.IO and in a batch, after a
 * reconnect, from search — is shown once and in order. A realtime message
 * extends the window only when the window reaches the latest message (it
 * would otherwise leave a gap); scrolled back, it is counted instead
 * (`newWhileAway`) and read when the reader returns to the latest.
 */
@Injectable()
export class ConversationStore {
  private readonly api = inject(ChatApi);
  private readonly commands = inject(ChatCommands);
  private readonly chats = inject(ChatStore);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly chatId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly pending = signal<PendingMessage[]>([]);
  readonly hasOlder = signal(false);
  readonly hasNewer = signal(false);
  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  readonly loadingNewer = signal(false);
  readonly error = signal<unknown>(null);
  /** The message to bring into view and highlight (a search result). */
  readonly highlightId = signal<string | null>(null);
  /** Messages that arrived while the reader was scrolled back in the history. */
  readonly newWhileAway = signal(0);
  /** The window reaches the conversation's latest message. */
  readonly atLatest = computed(() => !this.hasNewer());
  readonly lastSeq = computed(() => this.messages().at(-1)?.seq ?? 0);
  readonly me = computed(() => this.auth.user()?.id ?? null);

  /** Opens a conversation on its latest batch. */
  async open(chatId: string): Promise<void> {
    this.chatId.set(chatId);
    this.messages.set([]);
    this.pending.set([]);
    this.highlightId.set(null);
    this.newWhileAway.set(0);
    await this.replace(() => this.api.messages(chatId));
  }

  /** Back to the latest messages (after reading old ones, or a search result). */
  async jumpToLatest(): Promise<void> {
    const chatId = this.chatId();
    if (!chatId) return;
    this.highlightId.set(null);
    this.newWhileAway.set(0);
    if (this.atLatest() && this.messages().length) return;
    await this.replace(() => this.api.messages(chatId));
  }

  /** The batch around one message — wherever it is in the history — and that message highlighted. */
  async jumpTo(messageId: string): Promise<void> {
    const chatId = this.chatId();
    if (!chatId) return;
    if (this.messages().some((message) => message.id === messageId)) {
      this.highlightId.set(messageId);
      return;
    }
    await this.replace(() => this.api.context(chatId, messageId));
    this.highlightId.set(messageId);
  }

  /** One batch older than the oldest shown (scrolling up). Resolves false when there was nothing to load. */
  async loadOlder(): Promise<boolean> {
    const chatId = this.chatId();
    const oldest = this.messages()[0];
    if (!chatId || !oldest || !this.hasOlder() || this.loadingOlder() || this.loading()) return false;
    this.loadingOlder.set(true);
    try {
      const page = await firstValueFrom(this.api.messages(chatId, { before: oldest.seq }));
      if (this.chatId() !== chatId) return false;
      this.hasOlder.set(page.hasOlder);
      this.place(page.items, 'start');
      return true;
    } catch (error) {
      this.error.set(error);
      return false;
    } finally {
      this.loadingOlder.set(false);
    }
  }

  /** One batch newer than the newest shown (scrolling back down after jumping into the history, or catching up after a reconnect). */
  async loadNewer(): Promise<boolean> {
    const chatId = this.chatId();
    const newest = this.messages().at(-1);
    if (!chatId || this.loadingNewer() || this.loading()) return false;
    if (!newest) return false;
    this.loadingNewer.set(true);
    try {
      const page = await firstValueFrom(this.api.messages(chatId, { after: newest.seq }));
      if (this.chatId() !== chatId) return false;
      this.hasNewer.set(page.hasNewer);
      if (!page.hasNewer) this.newWhileAway.set(0);
      this.place(page.items, 'end');
      this.delivered(chatId, page.items);
      return page.items.length > 0;
    } catch (error) {
      this.error.set(error);
      return false;
    } finally {
      this.loadingNewer.set(false);
    }
  }

  /** A message from the realtime connection. */
  receive(message: ChatMessage): void {
    if (message.chatId !== this.chatId()) return;
    if (this.messages().some((shown) => shown.id === message.id)) return this.replaceMessage(message);
    // Ours, sent from this tab: the pending copy becomes the stored message.
    if (message.clientMessageId) this.pending.update((items) => items.filter((item) => item.clientMessageId !== message.clientMessageId));
    if (this.hasNewer()) {
      // Scrolled back in the history: appending would leave a gap — count it instead.
      this.newWhileAway.update((count) => count + 1);
      return;
    }
    // Appended without trimming the top (that would move what the reader is looking at); the next batch load trims.
    this.place([message], 'end', false);
  }

  /** A message its sender edited (shown with its new text where it is in the window; nothing is added). */
  update(message: ChatMessage): void {
    if (message.chatId === this.chatId()) this.replaceMessage(message);
  }

  /** Edits one of this user's own messages (the API decides; a refusal is thrown to the caller). */
  async editMessage(messageId: string, text: string): Promise<void> {
    const chatId = this.chatId();
    if (!chatId) return;
    this.update(await firstValueFrom(this.api.editMessage(chatId, messageId, text.trim())));
  }

  /** A message its sender deleted. */
  markDeleted(messageId: string): void {
    this.messages.update((messages) => messages.map((message) => (message.id === messageId ? { ...message, text: null, deleted: true } : message)));
  }

  /** After a reconnect: the messages that came while offline, from the API (only when reading the latest). */
  async catchUp(): Promise<void> {
    if (!this.atLatest() || !this.messages().length) return;
    this.hasNewer.set(true);
    for (let batch = 0; batch < 3 && this.hasNewer(); batch += 1) await this.loadNewer();
    // Far behind: start again from the latest rather than walking the whole gap.
    if (this.hasNewer()) await this.jumpToLatest();
  }

  /** Shows the message at once, sends it, and replaces it with the stored one (or marks it failed, to retry). */
  async send(text: string, clientMessageId: string = crypto.randomUUID()): Promise<boolean> {
    const chatId = this.chatId();
    const trimmed = text.trim();
    if (!chatId || !trimmed) return false;
    if (!this.atLatest()) await this.jumpToLatest();
    this.pending.update((items) => [...items.filter((item) => item.clientMessageId !== clientMessageId), { clientMessageId, text: trimmed, createdAt: new Date().toISOString(), state: 'sending', error: null }]);
    try {
      const ack = await this.commands.send(chatId, clientMessageId, trimmed);
      if (!ack.ok) {
        this.fail(clientMessageId, this.i18n.errorText(ack.error));
        return false;
      }
      this.pending.update((items) => items.filter((item) => item.clientMessageId !== clientMessageId));
      if (this.chatId() === chatId && !this.hasNewer()) this.place([ack.message], 'end');
      return true;
    } catch {
      this.fail(clientMessageId, this.i18n.t('chat.errors.notSent'));
      return false;
    }
  }

  /** Sends a failed message again (same id: stored at most once). */
  retry(clientMessageId: string): Promise<boolean> {
    const item = this.pending().find((pending) => pending.clientMessageId === clientMessageId);
    return item ? this.send(item.text, clientMessageId) : Promise.resolve(false);
  }

  discard(clientMessageId: string): void {
    this.pending.update((items) => items.filter((item) => item.clientMessageId !== clientMessageId));
  }

  async deleteMessage(messageId: string): Promise<void> {
    const chatId = this.chatId();
    if (!chatId) return;
    await firstValueFrom(this.api.deleteMessage(chatId, messageId));
    this.markDeleted(messageId);
  }

  private async replace(load: () => ReturnType<ChatApi['messages']>): Promise<void> {
    const chatId = this.chatId();
    this.loading.set(true);
    this.error.set(null);
    try {
      const page: ChatMessagePage = await firstValueFrom(load());
      if (this.chatId() !== chatId) return;
      this.messages.set(page.items.slice(-MESSAGE_WINDOW));
      this.hasOlder.set(page.hasOlder);
      this.hasNewer.set(page.hasNewer);
      if (chatId) this.delivered(chatId, page.items);
    } catch (error) {
      this.error.set(error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Merges by id, orders by position, keeps the window: too many → the far
   * end goes (and is marked as having more). Live messages (`trim` false)
   * may overrun the window a little rather than move the screen; never by
   * more than half of it.
   */
  private place(incoming: ChatMessage[], side: 'start' | 'end', trim = true): void {
    if (!incoming.length) return;
    const byId = new Map(this.messages().map((message) => [message.id, message]));
    for (const message of incoming) byId.set(message.id, message);
    const merged = [...byId.values()].sort((a, b) => a.seq - b.seq);
    if (merged.length <= (trim ? MESSAGE_WINDOW : MESSAGE_WINDOW * 1.5)) {
      this.messages.set(merged);
      return;
    }
    if (side === 'start') {
      this.messages.set(merged.slice(0, MESSAGE_WINDOW));
      this.hasNewer.set(true);
    } else {
      this.messages.set(merged.slice(-MESSAGE_WINDOW));
      this.hasOlder.set(true);
    }
  }

  /** A batch reached this device: delivered up to its newest message. */
  private delivered(chatId: string, items: ChatMessage[]): void {
    const newest = items.at(-1)?.seq;
    if (newest) this.chats.reportDelivered(chatId, newest);
  }

  private replaceMessage(message: ChatMessage): void {
    this.messages.update((messages) => messages.map((shown) => (shown.id === message.id ? message : shown)));
  }

  private fail(clientMessageId: string, error: string): void {
    this.pending.update((items) => items.map((item) => (item.clientMessageId === clientMessageId ? { ...item, state: 'failed', error } : item)));
  }
}
