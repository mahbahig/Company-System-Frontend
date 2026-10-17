import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ArrowDown } from 'lucide';

import type { ChatMessage, ChatReceipt } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ConversationStore, type PendingMessage } from './conversation.store';
import { MessageBubbleComponent, type MessageReceipt } from './message-bubble.component';

/** Load the next batch while this much history is still above (or below) the visible part — before the reader reaches the edge. */
const PREFETCH_SCREENS = 1.5;
const MIN_PREFETCH_PX = 600;
/** Within this distance of the bottom the reader counts as reading the latest (new messages keep it in view). */
const BOTTOM_SLACK_PX = 120;
/** A run by one sender breaks after this pause (name and picture shown again). */
const RUN_BREAK_MS = 5 * 60_000;

type Row = { kind: 'day'; key: string; label: string } | { kind: 'message'; key: string; message: ChatMessage; first: boolean };

/** Where a message sat on screen before the list changed (to put it back exactly there). */
interface Anchor {
  id: string;
  offset: number;
}

/**
 * The conversation's history as one continuous scroll, loaded in batches
 * the reader never sees: nearing the top loads the batch before (well
 * before the edge — the next batch is usually there before it is needed),
 * nearing the bottom of an older window loads the batch after. The list
 * holds the store's window only (at most a few hundred messages in the
 * page), never the whole history.
 *
 * The reading position never jumps: before a batch is added above (or the
 * far end of the window dropped), the first visible message and its
 * distance from the top are noted, and once the page is re-rendered the
 * scroll position is set so that message is exactly where it was (the
 * browser's own scroll anchoring is off, so only this applies). New
 * messages keep a reader who is at the bottom at the bottom; anyone reading
 * further up sees "new messages" instead of being moved.
 */
@Component({
  selector: 'app-message-list',
  imports: [TranslatePipe, IconComponent, MessageBubbleComponent],
  templateUrl: './message-list.component.html',
  host: { class: 'relative flex min-h-0 flex-1 flex-col' },
})
export class MessageListComponent {
  protected readonly store = inject(ConversationStore);
  protected readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');

  /** Group conversations show who wrote each run. */
  readonly showSenders = input(true);
  /** The other members' delivered / seen positions (null until the details are read). */
  readonly receipts = input<ChatReceipt[] | null>(null);
  /** The message being edited in the composer (highlighted as such). */
  readonly editingId = input<string | null>(null);
  /** The member may write here now (edit offered on their own messages). */
  readonly canWrite = input(true);
  /** Their own messages may be deleted now (not while the conversation is locked). */
  readonly canDelete = input(true);
  /** The reader is at the latest message with the page visible: everything shown is read. */
  readonly readUpTo = output<number>();
  readonly deleteMessage = output<ChatMessage>();
  readonly editMessage = output<ChatMessage>();
  readonly retry = output<PendingMessage>();
  readonly discard = output<PendingMessage>();

  protected readonly icons = { down: ArrowDown };
  /** The other members' positions, sorted — "seen by N" is a count of positions at or past a message (a binary search, not a list per message). */
  private readonly positions = computed(() => {
    const receipts = this.receipts();
    if (!receipts) return null;
    return {
      total: receipts.length,
      delivered: receipts.map((receipt) => receipt.deliveredSeq).sort((a, b) => a - b),
      seen: receipts.map((receipt) => receipt.readSeq).sort((a, b) => a - b),
    };
  });
  /** The reader is at (or very near) the bottom. */
  protected readonly nearBottom = signal(true);
  /** New messages from others that arrived while the reader was further up. */
  protected readonly unseen = signal(0);
  protected readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    let day = '';
    let previous: ChatMessage | null = null;
    for (const message of this.store.messages()) {
      const key = this.i18n.dayKey(message.createdAt);
      if (key !== day) {
        day = key;
        rows.push({ kind: 'day', key: `day-${key}`, label: this.dayLabel(message.createdAt) });
        previous = null;
      }
      const first = !previous || previous.sender?.id !== message.sender?.id || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > RUN_BREAK_MS;
      rows.push({ kind: 'message', key: message.id, message, first });
      previous = message;
    }
    return rows;
  });

  private lastId: string | null = null;
  private lastPending = 0;
  /** A batch is being added: its own position handling applies, not the "new message" one. */
  private batching = false;

  constructor() {
    // A window replaced (opened, jumped to the latest or to a search result): to the bottom, or to the highlighted message.
    effect(() => {
      const loading = this.store.loading();
      const highlight = this.store.highlightId();
      if (loading) return;
      untracked(() => {
        this.lastId = this.store.messages().at(-1)?.id ?? null;
        afterNextRender(() => (highlight ? this.reveal(highlight) : this.toBottom()), { injector: this.injector });
      });
    });
    // Messages added at the end (realtime, or the reader's own): keep a reader at the bottom there; count them otherwise.
    effect(() => {
      const messages = this.store.messages();
      const pending = this.store.pending().length;
      untracked(() => this.onListChanged(messages, pending));
    });
    // Reading at the bottom with the page visible = read — when the reader gets there, and as new messages arrive there.
    effect(() => {
      const last = this.store.lastSeq();
      if (last && this.nearBottom() && this.store.atLatest() && !this.store.loading()) untracked(() => this.reportRead());
    });
    const onVisible = () => this.reportRead();
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('visibilitychange', onVisible));
  }

  protected mine(message: ChatMessage): boolean {
    return message.sender?.id === this.store.me();
  }

  /** Sent (stored) → Delivered (on every other member's device) → Seen (by every other member); counts for a group. */
  protected receipt(message: ChatMessage): MessageReceipt | null {
    const positions = this.positions();
    if (!this.mine(message) || message.deleted || !positions) return null;
    const seen = atOrPast(positions.seen, message.seq);
    const delivered = atOrPast(positions.delivered, message.seq);
    const all = positions.total > 0;
    const state = all && seen === positions.total ? 'seen' : all && delivered === positions.total ? 'delivered' : 'sent';
    return { state, seen, delivered, total: positions.total };
  }

  protected onScroll(): void {
    const element = this.viewport().nativeElement;
    const threshold = Math.max(MIN_PREFETCH_PX, element.clientHeight * PREFETCH_SCREENS);
    const fromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.nearBottom.set(fromBottom < BOTTOM_SLACK_PX);
    if (this.nearBottom()) this.unseen.set(0);
    if (element.scrollTop < threshold && this.store.hasOlder()) void this.load('older');
    else if (fromBottom < threshold && this.store.hasNewer()) void this.load('newer');
  }

  /** "New messages" / back to the latest: the window moves to the latest batch if it is elsewhere. */
  protected async toLatest(): Promise<void> {
    this.unseen.set(0);
    if (this.store.atLatest()) {
      this.toBottom(true);
      return;
    }
    await this.store.jumpToLatest();
  }

  /** One batch, keeping the first visible message exactly where it is on screen. */
  private async load(direction: 'older' | 'newer'): Promise<void> {
    if (this.batching || this.store.loadingOlder() || this.store.loadingNewer() || this.store.loading()) return;
    this.batching = true;
    const anchor = this.captureAnchor();
    const loaded = direction === 'older' ? await this.store.loadOlder() : await this.store.loadNewer();
    if (!loaded) {
      this.batching = false;
      return;
    }
    afterNextRender(
      () => {
        this.restoreAnchor(anchor);
        this.lastId = this.store.messages().at(-1)?.id ?? null;
        this.batching = false;
        // A short batch that does not fill the screen yet: keep going (nobody can scroll to ask for it).
        const element = this.viewport().nativeElement;
        if (direction === 'older' && element.scrollTop < Math.max(MIN_PREFETCH_PX, element.clientHeight * PREFETCH_SCREENS) && this.store.hasOlder()) void this.load('older');
      },
      { injector: this.injector },
    );
  }

  /** Messages added at the end (realtime, the reader's own): a reader at the bottom stays there; one reading further up sees a count. */
  private onListChanged(messages: ChatMessage[], pending: number): void {
    const sent = pending > this.lastPending;
    this.lastPending = pending;
    if (this.store.loading() || this.batching) return;
    const last = messages.at(-1)?.id ?? null;
    const previous = this.lastId ? messages.findIndex((message) => message.id === this.lastId) : -1;
    const grewAtEnd = last !== this.lastId && previous !== -1 && previous < messages.length - 1;
    this.lastId = last;
    if (!grewAtEnd && !sent) return;
    const ownNewest = !!messages.at(-1) && this.mine(messages.at(-1)!);
    if (this.nearBottom() || sent || (grewAtEnd && ownNewest)) afterNextRender(() => this.toBottom(true), { injector: this.injector });
    else this.unseen.update((count) => count + messages.length - 1 - previous);
  }

  private captureAnchor(): Anchor | null {
    const element = this.viewport().nativeElement;
    const top = element.scrollTop;
    for (const node of Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]'))) {
      if (node.offsetTop + node.offsetHeight > top) return { id: node.dataset['messageId']!, offset: node.offsetTop - top };
    }
    return null;
  }

  private restoreAnchor(anchor: Anchor | null): void {
    if (!anchor) return;
    const element = this.viewport().nativeElement;
    const node = element.querySelector<HTMLElement>(`[data-message-id="${anchor.id}"]`);
    if (node) element.scrollTop = node.offsetTop - anchor.offset;
  }

  private toBottom(smooth = false): void {
    const element = this.viewport().nativeElement;
    if (typeof element.scrollTo === 'function') element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else element.scrollTop = element.scrollHeight;
    this.nearBottom.set(true);
    this.unseen.set(0);
  }

  /** Brings the highlighted message to the middle of the screen; the highlight fades after a few seconds. */
  private reveal(messageId: string): void {
    const node = this.viewport().nativeElement.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    node?.scrollIntoView?.({ block: 'center' });
    setTimeout(() => {
      if (this.store.highlightId() === messageId) this.store.highlightId.set(null);
    }, 4_000);
  }

  private reportRead(): void {
    if (this.document.visibilityState !== 'visible' || !this.nearBottom() || !this.store.atLatest()) return;
    const last = this.store.lastSeq();
    if (last) this.readUpTo.emit(last);
  }

  private dayLabel(value: string): string {
    const key = this.i18n.dayKey(value);
    if (key === this.i18n.dayKey(new Date())) return this.i18n.t('chat.today');
    if (key === this.i18n.dayKey(new Date(Date.now() - 86_400_000))) return this.i18n.t('chat.yesterday');
    return this.i18n.formatDate(value);
  }
}

/** How many sorted positions are at or past `seq`. */
function atOrPast(sorted: number[], seq: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] as number) < seq) low = middle + 1;
    else high = middle;
  }
  return sorted.length - low;
}
