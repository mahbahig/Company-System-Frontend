import { Component, ElementRef, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Clock, CornerDownLeft, Search, Star, type IconNode } from 'lucide';
import { debounceTime, distinctUntilChanged, map, of } from 'rxjs';

import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { NavigationService } from '../navigation/navigation.service';
import { FavoritesService } from '../records/favorites.service';
import { RecentRecords } from '../records/recent-records.service';
import { hitSubtitle } from '../records/record-hit-text';
import { RECORD_GROUP_ORDER, RECORD_ICONS, refKey, type RecordHit, type RecordRef } from '../records/record-ref';
import { RecordsApi } from '../records/records-api.service';
import { ReferenceDataService } from '../reference/reference-data.service';
import { KeyboardShortcuts } from '../shortcuts/keyboard-shortcuts.service';
import { CommandPalette } from './command-palette.service';
import { PaletteCommands, type PaletteCommand } from './palette-commands.service';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  badge?: string;
  icon: IconNode;
  keys?: string;
  run: () => void;
}

interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
}

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 200;
const MAX_SUGGESTED = 5;

/**
 * Ctrl/⌘+K command palette and global search in one place.
 *
 * Every entry is something the signed-in user may open or do right now:
 * - records come only from the server (search, favorites, recently viewed are
 *   all resolved under the caller's permission + record scope) and each link
 *   is re-checked against the route guard (`canOpen`);
 * - pages, create commands and actions come from `PaletteCommands`, which
 *   derives them from the permission-filtered navigation and permissions;
 * - nothing destructive is offered.
 *
 * WAI-ARIA combobox + listbox: the input keeps focus, ↑/↓ move the active
 * option (`aria-activedescendant`), Enter runs it, Escape closes.
 */
@Component({
  selector: 'app-command-palette',
  imports: [IconComponent, SkeletonComponent, TranslatePipe],
  template: `
    <dialog
      #dialog
      class="app-dialog app-palette m-0 mx-auto mt-[8vh] max-h-[min(38rem,84dvh)] w-[min(40rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/40 sm:mt-[12vh]"
      [attr.aria-label]="'ux.palette.title' | t"
      (close)="palette.hide()"
      (cancel)="palette.hide()"
      (click)="onBackdrop($event)"
    >
      <div class="flex max-h-[inherit] flex-col">
        <div class="flex items-center gap-2 border-b border-border px-3">
          <app-icon [icon]="searchIcon" svgClass="size-4 shrink-0 text-muted-foreground" />
          <input
            #input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="palette-list"
            [attr.aria-activedescendant]="activeId()"
            [attr.aria-label]="'ux.palette.inputLabel' | t"
            [placeholder]="'ux.palette.placeholder' | t"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown)="onKeydown($event)"
            autocomplete="off"
            spellcheck="false"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd class="hidden rounded border border-border px-1.5 py-0.5 text-2xs text-muted-foreground sm:inline" dir="ltr">Esc</kbd>
        </div>

        <div id="palette-list" role="listbox" [attr.aria-label]="'ux.palette.results' | t" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scroll-area">
          @for (group of groups(); track group.id) {
            <div role="group" [attr.aria-labelledby]="'palette-group-' + group.id" class="pb-1">
              <div [id]="'palette-group-' + group.id" class="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {{ group.label }}
              </div>
              @for (item of group.items; track item.id) {
                <div
                  role="option"
                  [id]="optionId(item)"
                  [attr.aria-selected]="item.id === active()?.id"
                  (mousemove)="setActive(item)"
                  (click)="run(item)"
                  class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-100"
                  [class.bg-secondary]="item.id === active()?.id"
                  [class.text-secondary-foreground]="item.id === active()?.id"
                >
                  <app-icon [icon]="item.icon" svgClass="size-4 shrink-0 text-muted-foreground" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate" dir="auto">{{ item.label }}</span>
                    @if (item.hint) {
                      <span class="block truncate text-xs text-muted-foreground" dir="auto">{{ item.hint }}</span>
                    }
                  </span>
                  @if (item.badge) {
                    <span class="tabular shrink-0 text-xs text-muted-foreground" dir="ltr">{{ item.badge }}</span>
                  }
                  @if (item.keys) {
                    <span class="hidden shrink-0 items-center gap-1 sm:flex" dir="ltr" aria-hidden="true">
                      @for (step of shortcuts.display(item.keys); track $index) {
                        <kbd class="rounded border border-border bg-background px-1.5 py-0.5 text-2xs text-muted-foreground">{{ step.join('+') }}</kbd>
                      }
                    </span>
                  }
                  @if (item.id === active()?.id) {
                    <app-icon [icon]="enterIcon" svgClass="size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
                  }
                </div>
              }
            </div>
          }
          @if (searching()) {
            <div class="flex flex-col gap-3 px-2 py-3" aria-hidden="true">
              @for (row of [0, 1, 2]; track row) {
                <div class="flex items-center gap-3">
                  <app-skeleton class="size-4 rounded" />
                  <app-skeleton class="h-3.5 flex-1" />
                  <app-skeleton class="h-3 w-12" />
                </div>
              }
            </div>
          }
          @if (!searching() && flat().length === 0) {
            <p class="px-3 py-10 text-center text-sm text-muted-foreground">
              {{ (trimmed().length ? 'ux.palette.empty' : 'ux.palette.emptyIdle') | t: { query: trimmed() } }}
            </p>
          }
        </div>

        <div class="hidden items-center gap-4 border-t border-border px-3 py-2 text-2xs text-muted-foreground sm:flex" aria-hidden="true">
          <span><kbd class="rounded border border-border px-1">↑</kbd> <kbd class="rounded border border-border px-1">↓</kbd> {{ 'ux.palette.hintMove' | t }}</span>
          <span><kbd class="rounded border border-border px-1">↵</kbd> {{ 'ux.palette.hintOpen' | t }}</span>
          <span><kbd class="rounded border border-border px-1">Esc</kbd> {{ 'ux.palette.hintClose' | t }}</span>
        </div>
      </div>
    </dialog>
    <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class CommandPaletteComponent {
  protected readonly palette = inject(CommandPalette);
  protected readonly shortcuts = inject(KeyboardShortcuts);
  private readonly commands = inject(PaletteCommands);
  private readonly navigation = inject(NavigationService);
  private readonly records = inject(RecordsApi);
  private readonly favorites = inject(FavoritesService);
  private readonly recent = inject(RecentRecords);
  private readonly reference = inject(ReferenceDataService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly searchIcon = Search;
  protected readonly enterIcon = CornerDownLeft;

  protected readonly query = signal('');
  protected readonly trimmed = computed(() => this.query().trim());
  private readonly debounced = toSignal(
    toObservable(this.trimmed).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** Scoped full-text search (server side), only while open and with enough text. */
  private readonly search = rxResource({
    params: () => (this.palette.open() && this.debounced().length >= MIN_QUERY ? this.debounced() : undefined),
    stream: ({ params }) => (params ? this.records.search(params) : of([] as RecordHit[])),
  });

  /** Recently viewed, resolved fresh (and access-checked) each time the palette opens. */
  private readonly recentRefs = computed<RecordRef[] | undefined>(() => (this.palette.open() ? untracked(() => this.recent.refs()) : undefined));
  private readonly recentHits = rxResource({
    params: () => this.recentRefs(),
    stream: ({ params }) => (params?.length ? this.records.resolve(params).pipe(map((hits) => ({ params, hits }))) : of({ params: params ?? [], hits: [] as RecordHit[] })),
  });

  protected readonly searching = computed(
    () => this.trimmed().length >= MIN_QUERY && (this.debounced() !== this.trimmed() || this.search.isLoading()),
  );

  protected readonly groups = computed<PaletteGroup[]>(() => {
    const q = normalize(this.trimmed());
    const matches = (text: string) => !q || normalize(text).includes(q);
    const groups: PaletteGroup[] = [];
    const shown = new Set<string>();

    const recordItems = (hits: readonly RecordHit[], icon?: IconNode) =>
      hits
        .filter((hit) => this.navigation.canOpen(hit.route) && !shown.has(refKey(hit)) && matches(`${hit.title} ${hit.number ?? ''} ${hit.subtitle ?? ''}`))
        .map((hit) => {
          shown.add(refKey(hit));
          return this.recordItem(hit, icon);
        });

    const favorites = recordItems(this.favorites.hits(), Star).slice(0, q ? 20 : MAX_SUGGESTED);
    if (favorites.length) groups.push({ id: 'favorites', label: this.i18n.t('ux.palette.groups.favorites'), items: favorites });
    const recent = recordItems(this.recentHits.value()?.hits ?? [], Clock).slice(0, q ? 20 : MAX_SUGGESTED);
    if (recent.length) groups.push({ id: 'recent', label: this.i18n.t('ux.palette.groups.recent'), items: recent });

    if (q.length >= MIN_QUERY && this.debounced() === this.trimmed()) {
      const hits = this.search.value() ?? [];
      for (const type of RECORD_GROUP_ORDER) {
        const items = recordItems(hits.filter((hit) => hit.type === type));
        if (items.length) groups.push({ id: `records-${type}`, label: this.i18n.t(`ux.palette.groups.records.${type}`), items });
      }
    }

    const commandItems = (commands: readonly PaletteCommand[]) =>
      commands.filter((command) => matches(`${command.label} ${command.hint ?? ''} ${command.keywords}`)).map((command) => this.commandItem(command));
    const create = commandItems(this.commands.creates());
    if (create.length) groups.push({ id: 'create', label: this.i18n.t('ux.palette.groups.create'), items: create });
    const pages = commandItems(this.commands.pages());
    if (pages.length) groups.push({ id: 'pages', label: this.i18n.t('ux.palette.groups.pages'), items: pages });
    const actions = commandItems(this.commands.actions());
    if (actions.length) groups.push({ id: 'actions', label: this.i18n.t('ux.palette.groups.actions'), items: actions });

    if (this.trimmed().length >= MIN_QUERY) {
      groups.push({
        id: 'search-all',
        label: this.i18n.t('ux.palette.groups.searchAll'),
        items: [
          {
            id: 'search-all',
            label: this.i18n.t('ux.palette.searchAll', { query: this.trimmed() }),
            icon: Search,
            run: () => this.go(`/search?q=${encodeURIComponent(this.trimmed())}`),
          },
        ],
      });
    }
    return groups;
  });

  protected readonly flat = computed(() => this.groups().flatMap((group) => group.items));
  /** Resets to the first option whenever the result list changes. */
  private readonly activeIndex = linkedSignal(() => (this.flat(), 0));
  protected readonly active = computed<PaletteItem | null>(() => this.flat()[this.activeIndex()] ?? null);
  protected readonly activeId = computed(() => (this.active() ? this.optionId(this.active()!) : null));
  protected readonly announcement = computed(() =>
    this.palette.open() && !this.searching() ? this.i18n.t('ux.palette.count', { count: this.flat().length }) : '',
  );

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.palette.open()) {
        if (!element.open) {
          untracked(() => this.query.set(''));
          void this.favorites.load(true);
          void this.reference.load();
          element.showModal?.();
          this.input().nativeElement.focus();
        }
      } else if (element.open) element.close();
    });
    // Prune recently-viewed entries the server no longer resolves (access lost, record gone).
    effect(() => {
      const value = this.recentHits.value();
      if (value?.params.length) untracked(() => this.recent.retain(value.params, value.hits));
    });
    effect(() => {
      const id = this.activeId();
      if (id) this.dialog().nativeElement.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected optionId(item: PaletteItem): string {
    return `palette-option-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  protected setActive(item: PaletteItem): void {
    const index = this.flat().indexOf(item);
    if (index >= 0 && index !== this.activeIndex()) this.activeIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.flat().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.set((this.activeIndex() + step + count) % count);
    } else if (event.key === 'Home' && !this.query()) {
      event.preventDefault();
      this.activeIndex.set(0);
    } else if (event.key === 'End' && !this.query()) {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, count - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.active();
      if (item) this.run(item);
    }
  }

  protected run(item: PaletteItem): void {
    this.palette.hide();
    item.run();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.palette.hide();
  }

  private recordItem(hit: RecordHit, icon?: IconNode): PaletteItem {
    const type = this.i18n.t(`search.types.${hit.type}`);
    const subtitle = hitSubtitle(hit, this.i18n, this.reference);
    return {
      id: `record:${refKey(hit)}`,
      label: hit.title || hit.number || type,
      hint: subtitle ? `${type} · ${subtitle}` : type,
      badge: hit.number,
      icon: icon ?? RECORD_ICONS[hit.type],
      run: () => this.go(hit.route),
    };
  }

  private commandItem(command: PaletteCommand): PaletteItem {
    return {
      id: command.id,
      label: command.label,
      hint: command.hint,
      icon: command.icon,
      keys: command.keys,
      run: command.path ? () => this.go(command.path!) : (command.run ?? (() => undefined)),
    };
  }

  /** Every navigation re-checks the route guard logic first (fail closed). */
  private go(path: string): void {
    if (!this.navigation.canOpen(path)) return;
    void this.router.navigateByUrl(this.navigation.link(path.startsWith('/') ? path : `/${path}`));
  }
}

/** Case- and diacritic-insensitive text for matching (Latin accents, Arabic tashkeel, alef forms). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}
