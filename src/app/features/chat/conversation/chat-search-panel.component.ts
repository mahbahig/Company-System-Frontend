import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Search, X } from 'lucide';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { ChatApi } from '../../../core/chat/chat-api.service';
import type { ChatMessage } from '../../../core/chat/chat.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AlertComponent } from '../../../shared/ui/alert/alert.component';
import { ButtonDirective } from '../../../shared/ui/button/button.directive';
import { InputDirective } from '../../../shared/ui/form/input.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { highlightSegments, type HighlightSegment } from '../shared/search-highlight';

/** Typing pauses this long before the server is asked (never a request per keystroke). */
export const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

/**
 * Search inside THIS conversation — on the server, through its encrypted
 * index, one batch at a time (the next batch when the list's end is
 * reached); nothing is searched in the browser and the conversation is never
 * downloaded to do it. Choosing a result opens the conversation at that
 * message, wherever it is in the history.
 */
@Component({
  selector: 'app-chat-search-panel',
  imports: [TranslatePipe, AlertComponent, ButtonDirective, IconComponent, InputDirective],
  templateUrl: './chat-search-panel.component.html',
  host: { class: 'flex min-h-0 flex-col' },
})
export class ChatSearchPanelComponent {
  private readonly api = inject(ChatApi);
  protected readonly i18n = inject(I18nService);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('queryBox');

  readonly chatId = input.required<string>();
  readonly open = output<ChatMessage>();
  readonly closed = output<void>();

  protected readonly icons = { search: Search, close: X };
  protected readonly query = signal('');
  protected readonly results = signal<ChatMessage[]>([]);
  protected readonly terms = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly searched = signal(false);
  protected readonly tooShort = computed(() => this.query().trim().length > 0 && this.query().trim().length < MIN_QUERY);
  private nextBefore: number | null = null;
  private generation = 0;

  constructor() {
    const subscription = toObservable(this.query)
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged())
      .subscribe((query) => void this.search(query));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  focus(): void {
    this.input()?.nativeElement.focus();
  }

  protected async search(raw: string): Promise<void> {
    const query = raw.trim();
    const generation = ++this.generation;
    this.results.set([]);
    this.hasMore.set(false);
    this.nextBefore = null;
    this.error.set(null);
    this.searched.set(false);
    if (query.length < MIN_QUERY) return;
    this.loading.set(true);
    try {
      const page = await firstValueFrom(this.api.search(this.chatId(), query));
      if (generation !== this.generation) return;
      this.results.set(page.items);
      this.terms.set(page.terms);
      this.hasMore.set(page.hasMore);
      this.nextBefore = page.nextBefore;
      this.searched.set(true);
    } catch (error) {
      if (generation === this.generation) this.error.set(error);
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  /** The next batch of results (the end of the list reached, or "Load more"). */
  protected async more(): Promise<void> {
    const query = this.query().trim();
    if (!this.hasMore() || this.loadingMore() || this.loading() || !this.nextBefore) return;
    const generation = this.generation;
    this.loadingMore.set(true);
    try {
      const page = await firstValueFrom(this.api.search(this.chatId(), query, this.nextBefore));
      if (generation !== this.generation) return;
      const seen = new Set(this.results().map((message) => message.id));
      this.results.update((items) => [...items, ...page.items.filter((message) => !seen.has(message.id))]);
      this.hasMore.set(page.hasMore);
      this.nextBefore = page.nextBefore;
    } catch (error) {
      this.error.set(error);
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected onResultsScroll(element: HTMLElement): void {
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 200) void this.more();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closed.emit();
  }

  protected sender(message: ChatMessage): string {
    return message.sender ? this.i18n.pick(message.sender.nameAr, message.sender.nameEn) : this.i18n.t('chat.unknownPerson');
  }

  /** The text with the matched words marked — the server's normalized terms, folded like its index (plain text pieces, never HTML). */
  protected segments(text: string | null): HighlightSegment[] {
    return highlightSegments(text, this.terms());
  }
}
