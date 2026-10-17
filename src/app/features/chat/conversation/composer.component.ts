import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Check, Pencil, SendHorizontal, X } from 'lucide';

import { type ChatMessage, MESSAGE_MAX_LENGTH } from '../../../core/chat/chat.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Typing is signalled at most this often, and stops after this long without a keystroke. */
const TYPING_REPEAT_MS = 3_000;
const TYPING_IDLE_MS = 4_000;
/** The counter appears this close to the limit. */
const COUNTER_FROM = MESSAGE_MAX_LENGTH - 500;

/**
 * Writing a message: Enter sends, Shift+Enter starts a new line; the box
 * grows with the text (up to a few lines). While the reader may not send —
 * the group locked, the team chat inactive, admin-only messaging for a
 * member — it says why instead (the API refuses anyway). Typing is
 * signalled in bursts, never per keystroke, and never stored.
 *
 * Editing one of your own messages uses the same box: it opens with the
 * message's text, Enter saves, Escape (or Cancel) leaves it unchanged, and a
 * refusal is shown here with the text kept.
 */
@Component({
  selector: 'app-chat-composer',
  imports: [TranslatePipe, ButtonDirective, IconComponent],
  template: `
    @if (blockedReason(); as key) {
      <p class="border-t border-border bg-secondary/60 px-4 py-3 text-center text-sm text-muted-foreground" data-testid="composer-blocked">{{ key | t }}</p>
    } @else {
      @if (editing()) {
        <div class="flex items-center gap-2 border-t border-border bg-secondary/50 px-4 py-2 text-xs" data-testid="composer-editing">
          <app-icon [icon]="icons.edit" svgClass="size-3.5 text-primary" />
          <span class="flex-1 font-medium">{{ 'chat.editing' | t }}</span>
          <button type="button" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="cancel()">
            <app-icon [icon]="icons.cancel" svgClass="size-3.5" />{{ 'chat.cancelEdit' | t }}
          </button>
        </div>
        @if (editError(); as error) {
          <p class="px-4 pt-2 text-xs text-destructive-tint" role="alert" data-testid="edit-error">{{ error }}</p>
        }
      }
      <form class="flex items-end gap-2 border-t border-border p-3" [class.border-t-0]="editing()" novalidate (submit)="submit($event)">
        <label class="sr-only" for="chat-composer">{{ 'chat.writeMessage' | t }}</label>
        <textarea
          #box
          id="chat-composer"
          rows="1"
          dir="auto"
          data-testid="chat-composer"
          class="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [placeholder]="'chat.writeMessage' | t"
          [maxLength]="max"
          [value]="text()"
          (input)="onInput($any($event.target))"
          (keydown)="onKey($event)"
          (blur)="stopTyping()"
        ></textarea>
        <button type="submit" appButton size="icon" class="shrink-0" data-testid="chat-send" [disabled]="!canSubmit()" [attr.aria-label]="(editing() ? 'chat.saveEdit' : 'chat.send') | t">
          @if (editing()) {
            <app-icon [icon]="icons.save" svgClass="size-4" />
          } @else {
            <app-icon [icon]="icons.send" svgClass="size-4 rtl:-scale-x-100" />
          }
        </button>
      </form>
      @if (text().length >= counterFrom) {
        <p class="px-4 pb-2 text-end text-2xs tabular" [class.text-destructive-tint]="text().length >= max" [class.text-muted-foreground]="text().length < max">{{ text().length }} / {{ max }}</p>
      }
    }
  `,
})
export class ChatComposerComponent {
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  /** Why sending is not possible right now (an i18n key), or null. */
  readonly blockedReason = input<string | null>(null);
  /** One of the user's own messages to edit (its text fills the box), or null to write a new one. */
  readonly editing = input<ChatMessage | null>(null);
  /** Why the last edit was refused (shown above the box), or null. */
  readonly editError = input<string | null>(null);
  readonly send = output<string>();
  readonly saveEdit = output<string>();
  readonly cancelEdit = output<void>();
  readonly typing = output<boolean>();

  protected readonly icons = { send: SendHorizontal, edit: Pencil, cancel: X, save: Check };
  /** What was being written when an edit started (put back afterwards). */
  private draft = '';
  protected readonly max = MESSAGE_MAX_LENGTH;
  protected readonly counterFrom = COUNTER_FROM;
  protected readonly text = signal('');
  protected readonly canSubmit = computed(() => !!this.text().trim() && this.text().length <= MESSAGE_MAX_LENGTH);
  private typingSince = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTyping());
    // Editing starts: the message's text in the box (what was being written is kept for later); ends: that draft back.
    let wasEditing = false;
    effect(() => {
      const message = this.editing();
      untracked(() => {
        if (message) {
          if (!wasEditing) this.draft = this.text();
          this.stopTyping();
          this.setText(message.text ?? '');
          setTimeout(() => this.focus());
        } else if (wasEditing) {
          this.setText(this.draft);
          this.draft = '';
        }
        wasEditing = !!message;
      });
    });
  }

  /** Puts the cursor in the box (the conversation opened). */
  focus(): void {
    this.box()?.nativeElement.focus();
  }

  protected onInput(element: HTMLTextAreaElement): void {
    this.text.set(element.value);
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    // Correcting a message already sent is not "typing" to the others.
    if (this.editing() || !element.value.trim()) return this.stopTyping();
    const now = Date.now();
    if (now - this.typingSince > TYPING_REPEAT_MS) {
      this.typingSince = now;
      this.typing.emit(true);
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stopTyping(), TYPING_IDLE_MS);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.editing()) {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const editing = this.editing();
    if (editing) {
      // Unchanged: nothing to save. Otherwise the parent saves and ends editing (or shows why not, the text kept).
      if (this.text().trim() === (editing.text ?? '').trim()) this.cancel();
      else this.saveEdit.emit(this.text().trim());
      return;
    }
    this.send.emit(this.text().trim());
    this.text.set('');
    const element = this.box()?.nativeElement;
    if (element) {
      element.value = '';
      element.style.height = 'auto';
    }
    this.stopTyping();
  }

  protected cancel(): void {
    this.cancelEdit.emit();
  }

  private setText(value: string): void {
    this.text.set(value);
    const element = this.box()?.nativeElement;
    if (!element) return;
    element.value = value;
    element.style.height = 'auto';
    if (value) element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  protected stopTyping(): void {
    clearTimeout(this.idleTimer);
    if (!this.typingSince) return;
    this.typingSince = 0;
    this.typing.emit(false);
  }
}
