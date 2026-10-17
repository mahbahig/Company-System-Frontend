import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { fakeSocketFactory } from '../../../testing/fake-socket';
import { ChatApi } from '../../core/chat/chat-api.service';
import { ChatCommands } from '../../core/chat/chat-commands.service';
import { ChatStore } from '../../core/chat/chat-store.service';
import type { ChatMessage, ChatReceipt, ChatSummary } from '../../core/chat/chat.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { SOCKET_FACTORY } from '../../core/realtime/realtime.service';
import { ChatComposerComponent } from './conversation/composer.component';
import { ConversationStore } from './conversation/conversation.store';
import { MessageBubbleComponent, type MessageReceipt } from './conversation/message-bubble.component';
import { MessageListComponent } from './conversation/message-list.component';

const ME = 'u-sales_representative';
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function message(seq: number, sender = ME, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${seq}`,
    chatId: 'c1',
    seq,
    sender: { id: sender, nameEn: sender, nameAr: sender, jobTitleEn: null, jobTitleAr: null, avatarVersion: null },
    text: `message ${seq}`,
    deleted: false,
    unavailable: false,
    clientMessageId: null,
    createdAt: new Date(Date.UTC(2026, 9, 17, 9, 0, seq)).toISOString(),
    editedAt: null,
    ...overrides,
  };
}

function summary(id: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    type: 'group',
    name: id,
    nameAr: id,
    peer: null,
    status: 'active',
    locked: false,
    adminOnly: false,
    memberCount: 3,
    myRole: 'member',
    unreadCount: 0,
    lastSeq: 5,
    lastReadSeq: 5,
    lastDeliveredSeq: 5,
    lastMessage: null,
    lastMessageAt: null,
    capabilities: { send: true, manageMembers: false, rename: false, changeAdminMode: false },
    ...overrides,
  };
}

function commandsMock() {
  return {
    connected: () => true,
    connections: () => 1,
    on: () => new Subject().asObservable(),
    send: vi.fn(),
    markRead: vi.fn(async () => ({ ok: true, readSeq: 0 })),
    markDelivered: vi.fn(async () => ({ ok: true, deliveredSeq: 0 })),
    markDeliveredMany: vi.fn(async () => ({ ok: true, delivered: [] })),
    typing: vi.fn(async () => ({ ok: true })),
  };
}

function configure(api: Partial<Record<keyof ChatApi, unknown>> = {}) {
  const commands = commandsMock();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SOCKET_FACTORY, useValue: fakeSocketFactory().factory },
      { provide: Router, useValue: { url: '/chat', navigate: vi.fn() } },
      { provide: ChatCommands, useValue: commands },
      { provide: ChatApi, useValue: { messages: vi.fn(() => of({ items: [], hasOlder: false, hasNewer: false })), list: vi.fn(() => of([])), ...api } },
      ConversationStore,
    ],
  });
  signInAs('sales_representative');
  const i18n = TestBed.inject(I18nService);
  i18n.locale.set('en');
  // No catalogue in unit tests: a key with its parameters shows what would be translated.
  vi.spyOn(i18n, 't').mockImplementation((key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key));
  return commands;
}

@Component({
  selector: 'app-bubble-host',
  imports: [MessageBubbleComponent],
  template: `<app-message-bubble [message]="message()" [mine]="mine()" [receipt]="receipt()" [group]="group()" (edit)="edited.push($event)" />`,
})
class BubbleHost {
  readonly message = signal(message(1));
  readonly mine = signal(true);
  readonly receipt = signal<MessageReceipt | null>(null);
  readonly group = signal(false);
  readonly edited: ChatMessage[] = [];
}

describe('Editing: offered on your own messages only (the API is the authority)', () => {
  it('your own message: Edit is offered and emits the message; someone else\'s: no Edit at all', async () => {
    configure();
    const fixture = TestBed.createComponent(BubbleHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-testid="edit-message"]')!.click();
    expect(fixture.componentInstance.edited.map((item) => item.id)).toEqual(['m1']);

    fixture.componentInstance.mine.set(false);
    fixture.componentInstance.message.set(message(2, 'u-other'));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="edit-message"]')).toBeNull();
  });

  it('a deleted or unreadable message offers no Edit; an edited one says "edited"', async () => {
    configure();
    const fixture = TestBed.createComponent(BubbleHost);
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.message.set(message(1, ME, { deleted: true, text: null }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="edit-message"]')).toBeNull();
    fixture.componentInstance.message.set(message(1, ME, { unavailable: true, text: null }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="edit-message"]')).toBeNull();
    fixture.componentInstance.message.set(message(1, ME, { text: 'fixed', editedAt: new Date().toISOString() }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="message-edited"]')?.textContent?.trim()).toBe('chat.edited');
  });
});

@Component({
  selector: 'app-composer-host',
  imports: [ChatComposerComponent],
  template: `<app-chat-composer [editing]="editing()" [editError]="error()" (send)="sent.push($event)" (saveEdit)="saved.push($event)" (cancelEdit)="cancelled = cancelled + 1" />`,
})
class ComposerHost {
  readonly editing = signal<ChatMessage | null>(null);
  readonly error = signal<string | null>(null);
  readonly sent: string[] = [];
  readonly saved: string[] = [];
  cancelled = 0;
}

describe('Composer edit mode', () => {
  async function render() {
    configure();
    const fixture = TestBed.createComponent(ComposerHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const box = () => root.querySelector<HTMLTextAreaElement>('#chat-composer')!;
    const type = (value: string) => {
      box().value = value;
      box().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const key = (name: string) => {
      box().dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));
      fixture.detectChanges();
    };
    return { fixture, root, box, type, key, host: fixture.componentInstance };
  }

  it('opens with the message\'s text; Enter saves the new text (never sends a new message)', async () => {
    const view = await render();
    view.host.editing.set(message(7, ME, { text: 'helo team' }));
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    expect(view.root.querySelector('[data-testid="composer-editing"]')).not.toBeNull();
    expect(view.box().value).toBe('helo team');
    view.type('hello team');
    view.key('Enter');
    expect(view.host.saved).toEqual(['hello team']);
    expect(view.host.sent).toEqual([]);
  });

  it('Escape cancels; saving unchanged text just cancels; a refusal is shown with the text kept; the draft comes back afterwards', async () => {
    const view = await render();
    view.type('half-written new message');
    view.host.editing.set(message(7, ME, { text: 'original' }));
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    view.key('Escape');
    expect(view.host.cancelled).toBe(1);
    view.key('Enter');
    expect(view.host.cancelled).toBe(2);
    expect(view.host.saved).toEqual([]);

    view.type('changed');
    view.host.error.set('Only the sender can edit a message.');
    view.fixture.detectChanges();
    expect(view.root.querySelector('[data-testid="edit-error"]')?.textContent).toContain('Only the sender');
    expect(view.box().value).toBe('changed');

    view.host.editing.set(null);
    view.fixture.detectChanges();
    await view.fixture.whenStable();
    expect(view.box().value).toBe('half-written new message');
  });
});

@Component({
  selector: 'app-receipts-host',
  imports: [MessageListComponent],
  providers: [ConversationStore],
  template: `<div style="height: 500px; display: flex"><app-message-list [receipts]="receipts()" [showSenders]="group()" /></div>`,
})
class ReceiptsHost {
  readonly store = inject(ConversationStore);
  readonly receipts = signal<ChatReceipt[] | null>(null);
  readonly group = signal(true);
}

describe('Delivered / Seen on your own messages', () => {
  const receipt = (userId: string, deliveredSeq: number, readSeq: number): ChatReceipt => ({ userId, deliveredSeq, readSeq, deliveredAt: null, readAt: null });

  async function render(items: ChatMessage[], receipts: ChatReceipt[] | null, group = true) {
    configure({ messages: vi.fn(() => of({ items, hasOlder: false, hasNewer: false })) });
    const fixture = TestBed.createComponent(ReceiptsHost);
    fixture.componentInstance.receipts.set(receipts);
    fixture.componentInstance.group.set(group);
    await fixture.componentInstance.store.open('c1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const state = (seq: number) => root.querySelector(`li[data-seq="${seq}"] [data-receipt]`)?.getAttribute('data-receipt') ?? null;
    const label = (seq: number) => root.querySelector(`li[data-seq="${seq}"] [data-receipt]`)?.getAttribute('title') ?? '';
    return { fixture, state, label };
  }

  it('group: Sent → Delivered (on every other member\'s device) → Seen (by all), with the counts in the label', async () => {
    const view = await render([message(3), message(4), message(6), message(7, 'u-other')], [receipt('a', 6, 3), receipt('b', 6, 4)]);
    expect(view.state(3)).toBe('seen');
    expect(view.state(4)).toBe('delivered');
    expect(view.label(4)).toBe('chat.receipt.delivered · chat.receipt.groupCounts{"seen":1,"delivered":2,"total":2}');
    expect(view.state(6)).toBe('delivered');
    expect(view.label(6)).toContain('{"seen":0,"delivered":2,"total":2}');
    // Someone else's message carries no ticks.
    expect(view.state(7)).toBeNull();
  });

  it('a message past anyone\'s delivered position is only Sent', async () => {
    const view = await render([message(9)], [receipt('a', 6, 6), receipt('b', 9, 9)]);
    expect(view.state(9)).toBe('sent');
    expect(view.label(9)).toBe('chat.receipt.sent · chat.receipt.groupCounts{"seen":1,"delivered":1,"total":2}');
  });

  it('private chat: the other person\'s position, no counts', async () => {
    const view = await render([message(2), message(3), message(4)], [receipt('peer', 3, 2)], false);
    expect([view.state(2), view.state(3), view.state(4)]).toEqual(['seen', 'delivered', 'sent']);
    expect(view.label(3)).toBe('chat.receipt.delivered');
  });

  it('no ticks until the positions are known', async () => {
    const view = await render([message(2)], null);
    expect(view.state(2)).toBeNull();
  });
});

describe('ChatStore reports delivered for this device — any conversation, gathered into one command', () => {
  it('a message from someone else (a group too) is reported delivered; your own is not', async () => {
    const commands = configure();
    const store = TestBed.inject(ChatStore);
    store.chats.set([summary('g1')]);
    store.loaded.set(true);
    const onMessage = (chatId: string, item: ChatMessage) => (store as unknown as { onMessage: (event: { chatId: string; message: ChatMessage }) => void }).onMessage({ chatId, message: item });
    onMessage('g1', { ...message(6, 'u-other'), chatId: 'g1' });
    onMessage('g1', { ...message(7, 'u-other'), chatId: 'g1' });
    onMessage('g1', { ...message(8, ME), chatId: 'g1' });
    await tick(500);
    expect(commands.markDeliveredMany).toHaveBeenCalledTimes(1);
    expect(commands.markDeliveredMany).toHaveBeenCalledWith([{ chatId: 'g1', seq: 7 }]);
    // Reported once: the same position again sends nothing.
    onMessage('g1', { ...message(7, 'u-other'), chatId: 'g1' });
    await tick(500);
    expect(commands.markDeliveredMany).toHaveBeenCalledTimes(1);
  });

  it('loading the list reports the conversations whose latest messages this device had not reported, in one command', async () => {
    const commands = configure({ list: vi.fn(() => of([summary('a', { lastSeq: 9, lastDeliveredSeq: 4 }), summary('b', { lastSeq: 3, lastDeliveredSeq: 3 }), summary('c', { type: 'private', lastSeq: 2, lastDeliveredSeq: 0 })])) });
    const store = TestBed.inject(ChatStore);
    await store.load();
    await tick(500);
    expect(commands.markDeliveredMany).toHaveBeenCalledTimes(1);
    expect(commands.markDeliveredMany).toHaveBeenCalledWith([
      { chatId: 'a', seq: 9 },
      { chatId: 'c', seq: 2 },
    ]);
  });

  it('a conversation opened on its latest batch: delivered up to the newest message loaded', async () => {
    const commands = configure({ messages: vi.fn(() => of({ items: [message(11, 'u-other'), message(12, 'u-other')], hasOlder: true, hasNewer: false })) });
    const conversation = TestBed.inject(ConversationStore);
    await conversation.open('c1');
    await tick(500);
    expect(commands.markDeliveredMany).toHaveBeenCalledWith([{ chatId: 'c1', seq: 12 }]);
  });
});

describe('ConversationStore — edits', () => {
  it('editMessage asks the API and shows the stored result in place; an update from elsewhere replaces only a shown message', async () => {
    const editMessage = vi.fn((_chatId: string, messageId: string, text: string) => of({ ...message(Number(messageId.slice(1))), text, editedAt: '2026-10-17T10:00:00.000Z' }));
    configure({ messages: vi.fn(() => of({ items: [message(1), message(2)], hasOlder: false, hasNewer: false })), editMessage });
    const store = TestBed.inject(ConversationStore);
    await store.open('c1');
    await store.editMessage('m2', '  corrected  ');
    expect(editMessage).toHaveBeenCalledWith('c1', 'm2', 'corrected');
    expect(store.messages().map((item) => [item.id, item.text, item.editedAt])).toEqual([
      ['m1', 'message 1', null],
      ['m2', 'corrected', '2026-10-17T10:00:00.000Z'],
    ]);
    store.update({ ...message(99), text: 'not in the window' });
    expect(store.messages()).toHaveLength(2);
    store.update({ ...message(1), text: 'edited elsewhere', editedAt: '2026-10-17T11:00:00.000Z' });
    expect(store.messages()[0]!.text).toBe('edited elsewhere');
  });
});
