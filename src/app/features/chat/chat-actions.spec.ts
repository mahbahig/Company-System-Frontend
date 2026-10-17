import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { signInAs } from '../../../testing/as-role';
import { fakeSocketFactory } from '../../../testing/fake-socket';
import { ChatApi } from '../../core/chat/chat-api.service';
import { ChatCommands } from '../../core/chat/chat-commands.service';
import { ChatStore } from '../../core/chat/chat-store.service';
import type { ChatDetails, ChatMessage, ChatSummary } from '../../core/chat/chat.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { SOCKET_FACTORY } from '../../core/realtime/realtime.service';
import { ContextMenuHostComponent } from '../../shared/ui/context-menu/context-menu-host.component';
import { ContextMenuDirective } from '../../shared/ui/context-menu/context-menu.directive';
import { type ContextMenuItem, ContextMenuService } from '../../shared/ui/context-menu/context-menu.service';
import { ChatListComponent } from './chat-list/chat-list.component';
import { MessageBubbleComponent, type MessageReceipt } from './conversation/message-bubble.component';
import { NewGroupDialogComponent } from './dialogs/new-chat-dialogs.component';

const ME = 'u-sales_representative';

@Component({ template: '' })
class Blank {}
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function summary(id: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    type: 'group',
    name: `Group ${id}`,
    nameAr: `Group ${id}`,
    peer: null,
    status: 'active',
    locked: false,
    adminOnly: false,
    memberCount: 3,
    myRole: 'member',
    unreadCount: 0,
    lastSeq: 1,
    lastReadSeq: 1,
    lastDeliveredSeq: 1,
    lastMessage: null,
    lastMessageAt: null,
    archived: false,
    capabilities: { send: true, manageMembers: false, rename: false, changeAdminMode: false, archive: true },
    ...overrides,
  };
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    chatId: 'c1',
    seq: 1,
    sender: { id: ME, nameEn: 'Me', nameAr: 'Me', jobTitleEn: null, jobTitleAr: null, avatarVersion: null },
    text: 'hello',
    deleted: false,
    unavailable: false,
    clientMessageId: null,
    createdAt: new Date().toISOString(),
    editedAt: null,
    ...overrides,
  };
}

/** Realtime events the test can push (`emit('chat:archived', …)`). */
function commandsMock() {
  const streams = new Map<string, Subject<unknown>>();
  const stream = (event: string) => streams.get(event) ?? streams.set(event, new Subject<unknown>()).get(event)!;
  return {
    emit: (event: string, data: unknown) => stream(event).next(data),
    connected: () => true,
    connections: () => 1,
    on: (event: string) => stream(event).asObservable(),
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
      provideRouter([{ path: '**', component: Blank }]),
      { provide: ChatCommands, useValue: commands },
      { provide: ChatApi, useValue: { list: vi.fn(() => of([])), messages: vi.fn(() => of({ items: [], hasOlder: false, hasNewer: false })), ...api } },
    ],
  });
  signInAs('sales_representative');
  const i18n = TestBed.inject(I18nService);
  i18n.locale.set('en');
  vi.spyOn(i18n, 't').mockImplementation((key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key));
  return commands;
}

const rightClick = (target: Element, x = 40, y = 40) => {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
  target.dispatchEvent(event);
  return event;
};
const menuItems = (root: ParentNode) => [...root.querySelectorAll('[data-testid^="menu-item-"]')].map((item) => item.getAttribute('data-testid')!.replace('menu-item-', ''));

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-menu-host',
  imports: [ContextMenuDirective, ContextMenuHostComponent],
  template: `
    <div id="target" [appContextMenu]="items" contextMenuLabel="Target actions" style="width: 100px; height: 40px">target</div>
    <div id="plain" [appContextMenu]="none">plain</div>
    <button id="outside" type="button">outside</button>
    <app-context-menu-host />
  `,
})
class MenuHost {
  readonly ran: string[] = [];
  readonly items = (): ContextMenuItem[] => [
    { id: 'first', label: 'First', run: () => this.ran.push('first') },
    { id: 'second', label: 'Second', destructive: true, run: () => this.ran.push('second') },
  ];
  readonly none = (): ContextMenuItem[] => [];
}

describe('Context menu (one reusable menu: right-click, long press, keyboard; inside the viewport)', () => {
  function render() {
    configure();
    const fixture = TestBed.createComponent(MenuHost);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('right-click opens it at the pointer instead of the browser menu; choosing an action closes it and runs the action', async () => {
    const { fixture, root } = render();
    const event = rightClick(root.querySelector('#target')!);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    const menu = root.querySelector<HTMLElement>('[data-testid="context-menu"]')!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.getAttribute('aria-label')).toBe('Target actions');
    expect(menuItems(root)).toEqual(['first', 'second']);
    expect(root.querySelector('[data-testid="menu-item-second"]')!.classList).toContain('text-destructive-tint');
    // Focus moves into the menu; the arrow keys move inside it.
    expect(document.activeElement?.getAttribute('data-testid')).toBe('menu-item-first');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement?.getAttribute('data-testid')).toBe('menu-item-second');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement?.getAttribute('data-testid')).toBe('menu-item-first');
    root.querySelector<HTMLButtonElement>('[data-testid="menu-item-second"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.ran).toEqual(['second']);
    expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();
    fixture.nativeElement.remove();
  });

  it('Escape and a click elsewhere close it; with no actions the browser keeps its own menu', async () => {
    const { fixture, root } = render();
    rightClick(root.querySelector('#target')!);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();

    rightClick(root.querySelector('#target')!);
    fixture.detectChanges();
    root.querySelector('#outside')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();

    const native = rightClick(root.querySelector('#plain')!);
    fixture.detectChanges();
    expect(native.defaultPrevented).toBe(false);
    expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();
    fixture.nativeElement.remove();
  });

  it('stays inside the viewport: a right-click at the bottom-right corner opens it above and to the left of the pointer', async () => {
    const { fixture, root } = render();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    rightClick(root.querySelector('#target')!, width - 2, height - 2);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    const menu = root.querySelector<HTMLElement>('[data-testid="context-menu"]')!;
    const box = menu.getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(width);
    expect(box.bottom).toBeLessThanOrEqual(height);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    fixture.nativeElement.remove();
  });

  it('touch: a long press opens it (no right-click on phones); a short tap does not', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, root } = render();
      const target = root.querySelector('#target')!;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 20 }));
      vi.advanceTimersByTime(200);
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
      vi.advanceTimersByTime(600);
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 20 }));
      vi.advanceTimersByTime(600);
      fixture.detectChanges();
      expect(menuItems(root)).toEqual(['first', 'second']);
      fixture.nativeElement.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the service opens nothing without actions, and an overflow button toggles its own menu', () => {
    configure();
    const service = TestBed.inject(ContextMenuService);
    expect(service.openAt([], 0, 0, null, 'x')).toBe(false);
    const button = document.createElement('button');
    document.body.appendChild(button);
    const items: ContextMenuItem[] = [{ id: 'a', label: 'A', run: () => undefined }];
    expect(service.toggleFrom(items, button, 'x')).toBe(true);
    expect(service.menu()?.align).toBe('end');
    expect(service.toggleFrom(items, button, 'x')).toBe(false);
    expect(service.menu()).toBeNull();
    button.remove();
  });
});

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-list-host',
  imports: [ChatListComponent, ContextMenuHostComponent],
  template: `<app-chat-list /><app-context-menu-host />`,
})
class ListHost {}

describe('Chat list: right-click → Archive / Unarchive (stored on the server first), never Delete', () => {
  async function render(chats: ChatSummary[]) {
    const setArchived = vi.fn((chatId: string, archived: boolean) => of({ ...chats.find((chat) => chat.id === chatId)!, archived, members: [], receipts: [] } as ChatDetails));
    const commands = configure({ list: vi.fn(() => of(chats)), setArchived });
    const store = TestBed.inject(ChatStore);
    store.listen();
    await store.load();
    const fixture = TestBed.createComponent(ListHost);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, setArchived, commands, store };
  }
  const listed = (root: HTMLElement) => [...root.querySelectorAll('[data-testid="chat-list"] [data-chat-id]')].map((link) => link.getAttribute('data-chat-id'));

  it('a member\'s menu offers Archive (no Delete); archiving asks the API, then the chat leaves the active list for the archive', async () => {
    const { fixture, root, setArchived } = await render([summary('a'), summary('b'), summary('p', { type: 'private', peer: { id: 'u-x', nameEn: 'X', nameAr: 'X', jobTitleEn: null, jobTitleAr: null, avatarVersion: null } })]);
    expect(listed(root)).toEqual(['a', 'b', 'p']);
    const row = root.querySelector('[data-chat-id="b"]')!.closest('li')!;
    expect(rightClick(row).defaultPrevented).toBe(true);
    fixture.detectChanges();
    expect(menuItems(root)).toEqual(['archive']);
    // Private chats and the company chat are never deletable by members: no Delete anywhere.
    rightClick(root.querySelector('[data-chat-id="p"]')!.closest('li')!);
    fixture.detectChanges();
    expect(menuItems(root)).toEqual(['archive']);
    rightClick(row);
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid="menu-item-archive"]')!.click();
    await tick();
    fixture.detectChanges();
    expect(setArchived).toHaveBeenCalledWith('b', true);
    expect(listed(root)).toEqual(['a', 'p']);
    // The archive view lists it, with Unarchive.
    root.querySelector<HTMLButtonElement>('[data-testid="chat-archive-open"]')!.click();
    fixture.detectChanges();
    expect(listed(root)).toEqual(['b']);
    root.querySelector<HTMLButtonElement>('[data-testid="chat-actions"]')!.click();
    fixture.detectChanges();
    expect(menuItems(root)).toEqual(['unarchive']);
    root.querySelector<HTMLButtonElement>('[data-testid="menu-item-unarchive"]')!.click();
    await tick();
    fixture.detectChanges();
    expect(setArchived).toHaveBeenCalledWith('b', false);
    // The emptied archive closes: back to the active list, with the chat in it.
    expect(listed(root).sort()).toEqual(['a', 'b', 'p']);
  });

  it('archived on another device: the realtime event moves it at once (no reload)', async () => {
    const { fixture, root, commands } = await render([summary('a'), summary('b')]);
    commands.emit('chat:archived', { chatId: 'a', archived: true });
    fixture.detectChanges();
    expect(listed(root)).toEqual(['b']);
    commands.emit('chat:deleted', { chatId: 'b' });
    fixture.detectChanges();
    expect(listed(root)).toEqual([]);
  });

  it('a refused archive leaves the list as it was and says why', async () => {
    const setArchived = vi.fn(() => {
      throw new Error('nope');
    });
    configure({ list: vi.fn(() => of([summary('a')])), setArchived });
    const store = TestBed.inject(ChatStore);
    await store.load();
    const fixture = TestBed.createComponent(ListHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    rightClick(root.querySelector('[data-chat-id="a"]')!.closest('li')!);
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-testid="menu-item-archive"]')!.click();
    await tick();
    fixture.detectChanges();
    expect(listed(root)).toEqual(['a']);
    expect(root.querySelector('[data-testid="chat-list-action-error"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-receipt-host',
  imports: [MessageBubbleComponent, ContextMenuHostComponent],
  template: `<app-message-bubble [message]="message()" [mine]="mine()" [receipt]="receipt()" /><app-context-menu-host />`,
})
class ReceiptHost {
  readonly message = signal(message());
  readonly mine = signal(true);
  readonly receipt = signal<MessageReceipt | null>({ state: 'delivered', seen: 0, delivered: 1, total: 1 });
}

describe('Message menu and the seen colour', () => {
  it('right-click on your own message: Edit and Delete; on someone else\'s: the browser menu, no actions', () => {
    configure();
    const fixture = TestBed.createComponent(ReceiptHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const bubble = () => root.querySelector('app-message-bubble [class*="rounded-2xl"]')!;
    expect(rightClick(bubble()).defaultPrevented).toBe(true);
    fixture.detectChanges();
    expect(menuItems(root)).toEqual(['edit', 'delete']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.componentInstance.mine.set(false);
    fixture.componentInstance.message.set(message({ sender: { id: 'u-other', nameEn: 'Other', nameAr: 'Other', jobTitleEn: null, jobTitleAr: null, avatarVersion: null } }));
    fixture.detectChanges();
    expect(rightClick(bubble()).defaultPrevented).toBe(false);
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="context-menu"]')).toBeNull();
    expect(root.querySelector('[data-testid="message-actions"]')).toBeNull();
  });

  it('seen ticks take the seen colour (and a bolder stroke); sent and delivered do not', () => {
    configure();
    const fixture = TestBed.createComponent(ReceiptHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tick = () => root.querySelector('[data-receipt]')!;
    expect(tick().getAttribute('data-receipt')).toBe('delivered');
    expect(tick().classList).not.toContain('text-chat-seen');
    fixture.componentInstance.receipt.set({ state: 'seen', seen: 1, delivered: 1, total: 1 });
    fixture.detectChanges();
    expect(tick().getAttribute('data-receipt')).toBe('seen');
    expect(tick().classList).toContain('text-chat-seen');
    expect(tick().querySelector('svg')!.getAttribute('class')).toContain('stroke-[2.75]');
    fixture.componentInstance.receipt.set({ state: 'sent', seen: 0, delivered: 0, total: 1 });
    fixture.detectChanges();
    expect(tick().classList).not.toContain('text-chat-seen');
  });
});

// ---------------------------------------------------------------------------

describe('Create Group: the name is required (red asterisk; blank is empty)', () => {
  function render() {
    const createGroup = vi.fn((name: string, memberIds: string[]) => of({ ...summary('new', { name }), members: [], receipts: [], memberIds } as unknown as ChatDetails));
    configure({ createGroup, people: vi.fn(() => of([])) });
    const fixture = TestBed.createComponent(NewGroupDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return { fixture, createGroup };
  }
  const root = (fixture: { nativeElement: HTMLElement }) => (document.querySelector('dialog') ?? fixture.nativeElement) as HTMLElement;

  it('shows the required asterisk; empty and whitespace-only names cannot be created and are reported once the field is left', () => {
    const { fixture, createGroup } = render();
    const view = root(fixture);
    const label = view.querySelector('label[for="group-name"]')!;
    expect(label.querySelector('.text-destructive')?.textContent).toBe('*');
    const input = view.querySelector<HTMLInputElement>('#group-name')!;
    expect(input.required).toBe(true);
    for (const value of ['', '   ']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(view.querySelector<HTMLButtonElement>('[data-testid="create-group"]')!.disabled).toBe(true);
      expect(view.querySelector('#group-name-error')?.textContent).toContain('chat.groupNameRequired');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    }
    view.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(createGroup).not.toHaveBeenCalled();
  });

  it('a valid name (with two colleagues) is sent trimmed', async () => {
    const { fixture, createGroup } = render();
    const view = root(fixture);
    const input = view.querySelector<HTMLInputElement>('#group-name')!;
    input.value = '  Site team  ';
    input.dispatchEvent(new Event('input'));
    const component = fixture.componentInstance as unknown as { members: { set(value: unknown[]): void } };
    component.members.set([
      { id: 'u1', nameEn: 'One', nameAr: 'One', jobTitleEn: null, jobTitleAr: null, avatarVersion: null, groupEligible: true },
      { id: 'u2', nameEn: 'Two', nameAr: 'Two', jobTitleEn: null, jobTitleAr: null, avatarVersion: null, groupEligible: true },
    ]);
    fixture.detectChanges();
    expect(view.querySelector<HTMLButtonElement>('[data-testid="create-group"]')!.disabled).toBe(false);
    view.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();
    expect(createGroup).toHaveBeenCalledWith('Site team', ['u1', 'u2']);
  });
});
