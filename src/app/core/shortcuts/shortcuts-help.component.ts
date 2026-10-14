import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { KeyboardShortcuts, type ShortcutGroup } from './keyboard-shortcuts.service';

const GROUP_ORDER: ShortcutGroup[] = ['general', 'navigation', 'page'];

/**
 * `?` — lists the shortcuts available to this user on this page right now
 * (navigation only for pages the role can open, page actions only when the
 * page shows them), so the list itself never advertises a forbidden action.
 */
@Component({
  selector: 'app-shortcuts-help',
  imports: [TranslatePipe],
  template: `
    <dialog
      #dialog
      aria-labelledby="shortcuts-heading"
      class="app-dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      (close)="shortcuts.helpOpen.set(false)"
      (cancel)="shortcuts.helpOpen.set(false)"
      (click)="onBackdrop($event)"
    >
      <div class="flex items-center justify-between gap-4 border-b border-border p-5">
        <h2 id="shortcuts-heading" class="text-lg font-semibold">{{ 'ux.shortcuts.title' | t }}</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [attr.aria-label]="'common.actions.close' | t"
          (click)="shortcuts.helpOpen.set(false)"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l10 10M15 5L5 15" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="flex flex-col gap-6 p-5">
        @for (group of groups(); track group.id) {
          <section [attr.aria-labelledby]="'shortcut-group-' + group.id">
            <h3 [id]="'shortcut-group-' + group.id" class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ 'ux.shortcuts.groups.' + group.id | t }}
            </h3>
            <dl class="divide-y divide-border rounded-md border border-border">
              @for (shortcut of group.items; track shortcut.id) {
                <div class="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <dt class="min-w-0 truncate">{{ shortcut.label() }}</dt>
                  <dd class="flex shrink-0 items-center gap-1" dir="ltr">
                    @for (step of shortcuts.display(shortcut.keys); track $index; let last = $last) {
                      <kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">{{ step.join(' + ') }}</kbd>
                      @if (!last) {
                        <span class="text-xs text-muted-foreground">{{ 'ux.shortcuts.then' | t }}</span>
                      }
                    }
                  </dd>
                </div>
              }
            </dl>
          </section>
        }
        <p class="text-xs text-muted-foreground">{{ 'ux.shortcuts.typingNote' | t }}</p>
      </div>
    </dialog>
  `,
})
export class ShortcutsHelpComponent {
  protected readonly shortcuts = inject(KeyboardShortcuts);
  private readonly i18n = inject(I18nService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly groups = computed(() => {
    this.i18n.locale();
    const all = this.shortcuts.all();
    return GROUP_ORDER.map((id) => ({ id, items: all.filter((shortcut) => shortcut.group === id) })).filter((group) => group.items.length);
  });

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.shortcuts.helpOpen() && !element.open) element.showModal?.();
      if (!this.shortcuts.helpOpen() && element.open) element.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.shortcuts.helpOpen.set(false);
  }
}
