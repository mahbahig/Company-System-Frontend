import { Component, computed, inject, input, output } from '@angular/core';
import { Check, CheckCheck, Pencil, Trash2 } from 'lucide';

import type { ChatMessage } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** How far one of your own messages has got: stored (sent), on every other member's device (delivered), seen by all — and the counts. */
export interface MessageReceipt {
  state: 'sent' | 'delivered' | 'seen';
  seen: number;
  delivered: number;
  total: number;
}

/**
 * One message. Its text is plain text (interpolated — never HTML), kept
 * with its line breaks. A group shows who wrote each run of messages; your
 * own messages sit on the other side with their ticks — one: sent, two:
 * delivered, two in colour: seen (a group's counts in the ticks' label) — and
 * offer edit / delete (the API allows them to the sender only). An edited
 * message says so.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [TranslatePipe, AvatarComponent, IconComponent],
  template: `
    <div class="group flex items-end gap-2" [class.flex-row-reverse]="mine()" [class.mt-3]="showSender()">
      @if (!mine() && showAvatar()) {
        <span class="w-8 shrink-0">
          @if (showSender()) {
            <app-avatar [userId]="message().sender?.id" [name]="senderName()" [version]="message().sender?.avatarVersion" size="sm" />
          }
        </span>
      }
      <div
        class="relative max-w-[min(36rem,80%)] rounded-2xl px-3 py-2 text-sm shadow-xs transition-shadow"
        [class.bg-primary]="mine() && !message().deleted"
        [class.text-primary-foreground]="mine() && !message().deleted"
        [class.bg-secondary]="!mine() || message().deleted"
        [class.ring-2]="highlighted() || editing()"
        [class.ring-warning]="highlighted()"
        [class.ring-ring]="editing() && !highlighted()"
        [class.ring-offset-2]="highlighted() || editing()"
        [attr.data-highlighted]="highlighted() ? '' : null"
      >
        @if (showSender() && !mine() && showAvatar()) {
          <p class="mb-0.5 text-xs font-semibold text-primary">{{ senderName() }}</p>
        }
        @if (message().deleted) {
          <p class="italic text-muted-foreground">{{ 'chat.messageDeleted' | t }}</p>
        } @else if (message().unavailable || message().text === null) {
          <p class="italic text-muted-foreground">{{ 'chat.messageUnavailable' | t }}</p>
        } @else {
          <p class="whitespace-pre-wrap break-words" dir="auto">{{ message().text }}</p>
        }
        <p class="mt-1 flex items-center justify-end gap-1 text-2xs tabular" [class.text-primary-foreground/80]="mine() && !message().deleted" [class.text-muted-foreground]="!mine() || message().deleted">
          @if (message().editedAt && !message().deleted) {
            <span data-testid="message-edited" [title]="i18n.formatDate(message().editedAt!, true)">{{ 'chat.edited' | t }}</span>
          }
          <time [attr.datetime]="message().createdAt" [title]="i18n.formatDate(message().createdAt, true)">{{ i18n.formatTime(message().createdAt) }}</time>
          @if (receipt(); as r) {
            <app-icon
              [icon]="r.state === 'sent' ? icons.sent : icons.delivered"
              svgClass="size-3.5"
              [class.text-info]="r.state === 'seen'"
              [attr.data-receipt]="r.state"
              [label]="receiptLabel()"
              [title]="receiptLabel()"
            />
          }
        </p>
      </div>
      @if (mine() && !message().deleted) {
        <span class="flex flex-col gap-0.5">
          @if (canEdit() && !message().unavailable && message().text !== null) {
            <button
              type="button"
              class="invisible rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:visible"
              data-testid="edit-message"
              [attr.aria-label]="'chat.editMessage' | t"
              (click)="edit.emit(message())"
            >
              <app-icon [icon]="icons.edit" svgClass="size-4" />
            </button>
          }
          @if (canDelete()) {
            <button
              type="button"
              class="invisible rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-destructive focus-visible:visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:visible"
              [attr.aria-label]="'chat.deleteMessage' | t"
              (click)="remove.emit(message())"
            >
              <app-icon [icon]="icons.remove" svgClass="size-4" />
            </button>
          }
        </span>
      }
    </div>
  `,
})
export class MessageBubbleComponent {
  protected readonly i18n = inject(I18nService);

  readonly message = input.required<ChatMessage>();
  readonly mine = input(false);
  /** First of a run by one sender: name and picture shown. */
  readonly showSender = input(true);
  /** Group conversations show who wrote (a private chat does not need to). */
  readonly showAvatar = input(true);
  readonly highlighted = input(false);
  /** Being edited in the composer. */
  readonly editing = input(false);
  readonly receipt = input<MessageReceipt | null>(null);
  /** A group conversation: the ticks' label gives the counts. */
  readonly group = input(false);
  readonly canEdit = input(true);
  readonly canDelete = input(true);
  readonly edit = output<ChatMessage>();
  readonly remove = output<ChatMessage>();

  protected readonly icons = { sent: Check, delivered: CheckCheck, edit: Pencil, remove: Trash2 };
  protected readonly receiptLabel = computed(() => {
    const receipt = this.receipt();
    if (!receipt) return '';
    const state = this.i18n.t(`chat.receipt.${receipt.state}`);
    return this.group() ? `${state} · ${this.i18n.t('chat.receipt.groupCounts', { seen: receipt.seen, delivered: receipt.delivered, total: receipt.total })}` : state;
  });
  protected readonly senderName = computed(() => {
    const sender = this.message().sender;
    return sender ? this.i18n.pick(sender.nameAr, sender.nameEn) : this.i18n.t('chat.unknownPerson');
  });
}
