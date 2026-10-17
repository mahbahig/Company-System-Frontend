import { Component, inject, input, signal } from '@angular/core';
import { MessagesSquare } from 'lucide';

import { ChatStore } from '../../core/chat/chat-store.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ChatListComponent } from './chat-list/chat-list.component';
import { ConversationComponent } from './conversation/conversation.component';
import { NewChatDialogComponent, NewGroupDialogComponent } from './dialogs/new-chat-dialogs.component';

/**
 * Messages: the conversation list beside the open conversation (`/chat/:chatId`);
 * on a phone one at a time. Open to every signed-in employee — what each
 * person sees comes from their own memberships on the server.
 */
@Component({
  selector: 'app-chat-page',
  imports: [TranslatePipe, AlertComponent, IconComponent, ChatListComponent, ConversationComponent, NewChatDialogComponent, NewGroupDialogComponent],
  template: `
    @if (closed()) {
      <app-alert class="mb-3">{{ 'chat.conversationClosed' | t }}</app-alert>
    }
    <div class="flex h-[calc(100dvh-5.5rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border bg-card sm:h-[calc(100dvh-6.5rem)]">
      <app-chat-list
        class="w-full shrink-0 border-e border-border md:w-80 lg:w-96"
        [class.hidden]="!!chatId()"
        [class.md:flex]="!!chatId()"
        [activeId]="chatId() ?? null"
        (newChat)="choosingPerson.set(true)"
        (newGroup)="creatingGroup.set(true)"
      />
      @if (chatId(); as id) {
        <app-conversation [chatId]="id" />
      } @else {
        <div class="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
          <span class="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <app-icon [icon]="icons.empty" svgClass="size-7" />
          </span>
          <h2 class="text-base font-semibold">{{ 'chat.pickConversation' | t }}</h2>
          <p class="max-w-sm text-sm text-muted-foreground">{{ 'chat.pickConversationHint' | t }}</p>
        </div>
      }
    </div>
    <app-new-chat-dialog [(open)]="choosingPerson" />
    <app-new-group-dialog [(open)]="creatingGroup" />
  `,
  host: { class: 'flex flex-col' },
})
export class ChatPage {
  private readonly store = inject(ChatStore);

  /** `/chat/:chatId`. */
  readonly chatId = input<string>();
  /** `?closed=1`: the conversation that was open is no longer available to this user. */
  readonly closed = input<string>();

  protected readonly icons = { empty: MessagesSquare };
  protected readonly choosingPerson = signal(false);
  protected readonly creatingGroup = signal(false);

  constructor() {
    this.store.listen();
    void this.store.load();
  }
}
