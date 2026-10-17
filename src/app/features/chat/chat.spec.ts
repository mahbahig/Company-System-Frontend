import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { signInAs } from '../../../testing/as-role';
import { fakeSocketFactory } from '../../../testing/fake-socket';
import { ChatApi } from '../../core/chat/chat-api.service';
import { ChatCommands } from '../../core/chat/chat-commands.service';
import { ChatStore } from '../../core/chat/chat-store.service';
import type { ChatMessage, ChatMessagePage, ChatSearchPage, ChatSummary } from '../../core/chat/chat.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { SOCKET_FACTORY } from '../../core/realtime/realtime.service';
import { ChatSearchPanelComponent, SEARCH_DEBOUNCE_MS } from './conversation/chat-search-panel.component';
import { ConversationStore, MESSAGE_WINDOW } from './conversation/conversation.store';
import { MessageListComponent } from './conversation/message-list.component';
import { highlightSegments } from './shared/search-highlight';

const API = environment.apiBaseUrl;
const ME = 'u-sales_representative';

/** A conversation of `total` messages, served in batches like the API (newest first, cursor by position). */
class FakeHistory {
  readonly calls: Array<{ before?: number; after?: number }> = [];
  readonly contextCalls: string[] = [];
  constructor(
    private readonly total: number,
    private readonly batch = 50,
  ) {}

  message(seq: number, sender = 'u-other'): ChatMessage {
    return { id: `m${seq}`, chatId: 'c1', seq, sender: { id: sender, nameEn: sender, nameAr: sender, jobTitleEn: null, jobTitleAr: null, avatarVersion: null }, text: `message ${seq}`, deleted: false, unavailable: false, clientMessageId: null, createdAt: new Date(Date.UTC(2026, 9, 17, 9, 0, seq)).toISOString(), editedAt: null };
  }

  page(cursor: { before?: number; after?: number } = {}): ChatMessagePage {
    this.calls.push(cursor);
    if (cursor.after !== undefined) {
      const from = cursor.after + 1;
      const to = Math.min(this.total, cursor.after + this.batch);
      return { items: this.range(from, to), hasOlder: from > 1, hasNewer: to < this.total };
    }
    const end = cursor.before === undefined ? this.total : cursor.before - 1;
    const start = Math.max(1, end - this.batch + 1);
    return { items: this.range(start, end), hasOlder: start > 1, hasNewer: end < this.total };
  }

  context(messageId: string): ChatMessagePage {
    this.contextCalls.push(messageId);
    const seq = Number(messageId.slice(1));
    const start = Math.max(1, seq - 25);
    const end = Math.min(this.total, seq + 24);
    return { items: this.range(start, end), hasOlder: start > 1, hasNewer: end < this.total, targetId: messageId };
  }

  private range(from: number, to: number): ChatMessage[] {
    const items: ChatMessage[] = [];
    for (let seq = from; seq <= to; seq += 1) items.push(this.message(seq));
    return items;
  }
}

function setup(history: FakeHistory, overrides: Partial<Record<keyof ChatCommands, unknown>> = {}) {
  const sent: Array<{ chatId: string; clientMessageId: string; text: string }> = [];
  const commands = {
    connected: () => true,
    connections: () => 1,
    on: () => new Subject().asObservable(),
    send: vi.fn(async (chatId: string, clientMessageId: string, text: string) => {
      sent.push({ chatId, clientMessageId, text });
      return { ok: true, message: { ...history.message(1_000_000, ME), id: `stored-${clientMessageId}`, seq: 1_000_000, text, clientMessageId } };
    }),
    markRead: vi.fn(async () => ({ ok: true, readSeq: 0 })),
    markDelivered: vi.fn(async () => ({ ok: true, deliveredSeq: 0 })),
    markDeliveredMany: vi.fn(async () => ({ ok: true, delivered: [] })),
    typing: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ConversationStore,
      { provide: SOCKET_FACTORY, useValue: fakeSocketFactory().factory },
      { provide: Router, useValue: { url: '/chat', navigate: vi.fn() } },
      { provide: ChatCommands, useValue: commands },
      {
        provide: ChatApi,
        useValue: {
          messages: vi.fn((_chatId: string, cursor?: { before?: number; after?: number }) => of(history.page(cursor ?? {}))),
          context: vi.fn((_chatId: string, messageId: string) => of(history.context(messageId))),
          deleteMessage: vi.fn(() => of(undefined)),
        },
      },
    ],
  });
  signInAs('sales_representative');
  return { store: TestBed.inject(ConversationStore), commands, sent };
}

const seqs = (messages: ChatMessage[]) => messages.map((message) => message.seq);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('ConversationStore — batches, never the whole history', () => {
  it('opens on the LATEST batch only (newest first: positions 951–1000 of 1,000)', async () => {
    const history = new FakeHistory(1_000);
    const { store } = setup(history);
    await store.open('c1');
    expect(history.calls).toEqual([{}]);
    expect(seqs(store.messages())).toEqual(range(951, 1_000));
    expect(store.hasOlder()).toBe(true);
    expect(store.atLatest()).toBe(true);
  });

  it('scrolling up asks for the batch before the oldest shown — no gap, no duplicate, in order', async () => {
    const history = new FakeHistory(1_000);
    const { store } = setup(history);
    await store.open('c1');
    await store.loadOlder();
    await store.loadOlder();
    expect(history.calls).toEqual([{}, { before: 951 }, { before: 901 }]);
    expect(seqs(store.messages())).toEqual(range(851, 1_000));
  });

  it('never holds more than the window: loading further back drops the newest end and marks it as having more', async () => {
    const history = new FakeHistory(10_000);
    const { store } = setup(history);
    await store.open('c1');
    for (let batch = 0; batch < 8; batch += 1) await store.loadOlder();
    expect(store.messages().length).toBe(MESSAGE_WINDOW);
    expect(store.hasNewer()).toBe(true);
    expect(seqs(store.messages())).toEqual(range(9_551, 9_850));
    // Scrolling back down reads the newer batch again.
    await store.loadNewer();
    expect(history.calls.at(-1)).toEqual({ after: 9_850 });
    expect(store.messages().length).toBe(MESSAGE_WINDOW);
    expect(store.messages().at(-1)!.seq).toBe(9_900);
  });

  it('a message arriving over Socket.IO AND in a batch (or twice after a reconnect) is shown once, in position order', async () => {
    const history = new FakeHistory(100);
    const { store } = setup(history);
    await store.open('c1');
    const late = history.message(102);
    const early = history.message(101);
    store.receive(late);
    store.receive(early);
    store.receive(late);
    expect(seqs(store.messages()).slice(-3)).toEqual([100, 101, 102]);
    expect(store.messages().filter((message) => message.id === 'm101')).toHaveLength(1);
  });

  it('a realtime message while reading older history is counted, not appended (no gap); back to the latest reads it', async () => {
    const history = new FakeHistory(500);
    const { store } = setup(history);
    await store.open('c1');
    await store.jumpTo('m10');
    expect(store.atLatest()).toBe(false);
    store.receive(history.message(501));
    expect(store.newWhileAway()).toBe(1);
    expect(store.messages().some((message) => message.seq === 501)).toBe(false);
  });

  it('loading older while a new message arrives keeps the order correct', async () => {
    const history = new FakeHistory(200);
    const { store } = setup(history);
    await store.open('c1');
    const loading = store.loadOlder();
    store.receive(history.message(201));
    await loading;
    expect(seqs(store.messages())).toEqual(range(101, 201));
  });

  it('jumping to a search result far back loads only the batch around it and highlights it', async () => {
    const history = new FakeHistory(100_000);
    const { store } = setup(history);
    await store.open('c1');
    await store.jumpTo('m37');
    expect(history.contextCalls).toEqual(['m37']);
    expect(store.messages().length).toBeLessThanOrEqual(50);
    expect(store.messages().map((message) => message.id)).toContain('m37');
    expect(store.highlightId()).toBe('m37');
    // A message already shown is only highlighted (no request).
    await store.jumpTo('m40');
    expect(history.contextCalls).toEqual(['m37']);
  });

  it('after a reconnect it reads what came while offline with `after` (only when at the latest)', async () => {
    const history = new FakeHistory(1_000);
    const { store } = setup(history);
    await store.open('c1');
    (history as unknown as { total: number }).total = 1_010;
    await store.catchUp();
    expect(history.calls.at(-1)).toEqual({ after: 1_000 });
    expect(store.messages().at(-1)!.seq).toBe(1_010);
    expect(new Set(store.messages().map((message) => message.id)).size).toBe(store.messages().length);
  });

  it('sending: shown at once, replaced by the stored message (the realtime copy of it adds nothing); a failure can be retried with the same id', async () => {
    const history = new FakeHistory(10);
    let fail = true;
    const { store, sent } = setup(history, {
      send: vi.fn(async (chatId: string, clientMessageId: string, text: string) => {
        sent.push({ chatId, clientMessageId, text });
        if (fail) return { ok: false, error: 'errors.chatLocked' };
        return { ok: true, message: { ...history.message(11, ME), clientMessageId, text } };
      }),
    });
    await store.open('c1');
    await store.send('hello');
    expect(store.pending()).toMatchObject([{ text: 'hello', state: 'failed' }]);
    fail = false;
    await store.retry(store.pending()[0]!.clientMessageId);
    expect(sent.map((item) => item.clientMessageId)).toEqual([sent[0]!.clientMessageId, sent[0]!.clientMessageId]);
    expect(store.pending()).toEqual([]);
    store.receive({ ...history.message(11, ME), clientMessageId: sent[0]!.clientMessageId });
    expect(store.messages().filter((message) => message.seq === 11)).toHaveLength(1);
  });
});

@Component({
  selector: 'app-message-list-host',
  imports: [MessageListComponent],
  providers: [ConversationStore],
  template: `<div style="height: 500px; display: flex"><app-message-list (readUpTo)="read.push($event)" /></div>`,
})
class MessageListHost {
  readonly store = inject(ConversationStore);
  readonly read: number[] = [];
}

describe('MessageListComponent — seamless batches and a stable reading position', () => {
  const ROW = 40;
  let restore: Array<() => void> = [];

  /** jsdom has no layout: each message is a 40 px row, the viewport 500 px tall. */
  function fakeLayout(): void {
    const define = (name: string, get: (this: HTMLElement) => number) => {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get });
      restore.push(() => original && Object.defineProperty(HTMLElement.prototype, name, original));
    };
    define('offsetTop', function () {
      const rows = Array.from(this.parentElement?.querySelectorAll(':scope > li[data-message-id]') ?? []);
      return Math.max(0, rows.indexOf(this)) * ROW;
    });
    define('offsetHeight', () => ROW);
    define('clientHeight', function () {
      return this.dataset['testid'] === 'message-viewport' ? 500 : ROW;
    });
    define('scrollHeight', function () {
      return this.querySelectorAll('li[data-message-id]').length * ROW;
    });
  }

  async function render(history: FakeHistory): Promise<{ fixture: ComponentFixture<MessageListHost>; viewport: HTMLElement }> {
    setup(history);
    fakeLayout();
    const fixture = TestBed.createComponent(MessageListHost);
    TestBed.inject(I18nService).locale.set('en');
    await fixture.componentInstance.store.open('c1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, viewport: fixture.nativeElement.querySelector('[data-testid="message-viewport"]') as HTMLElement };
  }

  afterEach(() => {
    restore.forEach((undo) => undo());
    restore = [];
  });

  it('renders only the window (one batch on opening), never the conversation', async () => {
    const { viewport } = await render(new FakeHistory(100_000));
    expect(viewport.querySelectorAll('li[data-message-id]').length).toBe(50);
  });

  it('nearing the top loads the batch before by itself (no "Load more"), and the message on screen stays exactly where it was', async () => {
    const history = new FakeHistory(1_000);
    const { fixture, viewport } = await render(history);
    // The reader scrolled up: message 953 sits at the top of the screen, 0 px from the edge.
    viewport.scrollTop = 2 * ROW;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(history.calls).toContainEqual({ before: 951 });
    expect(viewport.querySelectorAll('li[data-message-id]').length).toBeGreaterThanOrEqual(100);
    // 50 messages were added above: the same message is now row 52 — and the scroll position moved with it.
    const anchor = viewport.querySelector('li[data-message-id="m953"]') as HTMLElement;
    expect(viewport.scrollTop - anchor.offsetTop).toBe(0);
    expect(fixture.nativeElement.querySelector('button')?.textContent ?? '').not.toMatch(/load more/i);
  });

  it('reading at the bottom reports the newest position as read', async () => {
    const { fixture, viewport } = await render(new FakeHistory(60));
    viewport.scrollTop = viewport.scrollHeight - 500;
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.read.at(-1)).toBe(60);
  });

  it('the highlighted message (a search result) is marked', async () => {
    const history = new FakeHistory(1_000);
    const { fixture } = await render(history);
    await fixture.componentInstance.store.jumpTo('m200');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('li[data-message-id="m200"] [data-highlighted]')).not.toBeNull();
  });
});

describe('ChatSearchPanelComponent — server-side search inside one conversation', () => {
  it('waits for a pause in typing (no request per keystroke), asks for this conversation only, and loads further batches', async () => {
    vi.useFakeTimers();
    try {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: fakeSocketFactory().factory }] });
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(ChatSearchPanelComponent);
      fixture.componentRef.setInput('chatId', 'chat-a');
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('[data-testid="chat-search-input"]') as HTMLInputElement;
      for (const value of ['i', 'in', 'inv', 'invo', 'invoice']) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
        await vi.advanceTimersByTimeAsync(100);
      }
      http.expectNone(() => true);
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      const first = http.expectOne((request) => request.url === `${API}/chats/chat-a/messages/search`);
      expect(first.request.params.get('q')).toBe('invoice');
      const page: ChatSearchPage = { items: [new FakeHistory(30).message(30)], hasMore: true, nextBefore: 30, terms: ['invoice'] };
      first.flush({ success: true, ...page });
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="chat-search-more"]') as HTMLButtonElement).click();
      const second = http.expectOne((request) => request.url === `${API}/chats/chat-a/messages/search`);
      expect(second.request.params.get('before')).toBe('30');
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ChatStore — unread counts follow the realtime events', () => {
  it('a message from someone else counts as unread unless that conversation is on screen; reading clears it', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SOCKET_FACTORY, useValue: fakeSocketFactory().factory }] });
    signInAs('sales_representative');
    const store = TestBed.inject(ChatStore);
    const chat: ChatSummary = {
      id: 'c1', type: 'private', name: null, nameAr: null, peer: null, status: 'active', locked: false, adminOnly: false, memberCount: 2, myRole: 'member',
      unreadCount: 0, lastSeq: 2, lastReadSeq: 2, lastDeliveredSeq: 2, lastMessage: null, lastMessageAt: null, capabilities: { send: true, manageMembers: false, rename: false, changeAdminMode: false },
    };
    store.chats.set([chat]);
    store.loaded.set(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const onMessage = (seq: number) => (store as unknown as { onMessage: (event: { chatId: string; message: ChatMessage }) => void }).onMessage({ chatId: 'c1', message: new FakeHistory(seq).message(seq) });
    onMessage(3);
    expect(store.unreadTotal()).toBe(1);
    store.markRead('c1', 3);
    expect(store.unreadTotal()).toBe(0);
    // The conversation on screen: its new message is read at once.
    store.activeChatId.set('c1');
    onMessage(4);
    expect(store.find('c1')).toMatchObject({ lastSeq: 4, unreadCount: 0 });
    // Elsewhere again: counted.
    store.activeChatId.set(null);
    onMessage(5);
    expect(store.unreadTotal()).toBe(1);
    // The same message twice counts once.
    onMessage(5);
    expect(store.unreadTotal()).toBe(1);
  });
});

describe('highlightSegments — results marked the way the server matched them', () => {
  const char = (code: number) => String.fromCharCode(code);
  const marked = (text: string, terms: string[]) => highlightSegments(text, terms).filter((piece) => piece.match).map((piece) => piece.text);

  it('marks word prefixes, case-insensitively, never inside a word', () => {
    expect(marked('Invoices sent; reinvoice later', ['inv'])).toEqual(['Inv']);
    expect(marked('Café at noon', ['cafe'])).toEqual(['Café']);
  });

  it('marks Arabic whatever its diacritics, letter variant or article', () => {
    // "the invoice" written with teh marbuta and a fatha; the server's term uses heh, without the article.
    const word = `${char(0x0641)}${char(0x064e)}${char(0x0627)}${char(0x062a)}${char(0x0648)}${char(0x0631)}${char(0x0629)}`;
    const term = `${char(0x0641)}${char(0x0627)}${char(0x062a)}${char(0x0648)}${char(0x0631)}${char(0x0647)}`;
    const text = `${char(0x0627)}${char(0x0644)}${word} ${char(0x062c)}${char(0x0627)}${char(0x0647)}${char(0x0632)}${char(0x0629)}`;
    expect(marked(text, [term])).toEqual([word]);
  });

  it('keeps the text intact and never produces HTML', () => {
    const pieces = highlightSegments('<b>invoice</b> ok', ['invoice']);
    expect(pieces.map((piece) => piece.text).join('')).toBe('<b>invoice</b> ok');
    expect(pieces.find((piece) => piece.match)?.text).toBe('invoice');
  });
});
