import { Component, ElementRef, effect, inject, input, model, viewChild } from '@angular/core';

import { UnsavedChanges } from '../../../core/forms/unsaved-changes';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TooltipDirective } from '../tooltip/tooltip.directive';

/**
 * Modal dialog on the native `<dialog>` element: `showModal()` gives a real
 * focus trap, Escape-to-close and an inert background without extra code.
 * `<app-dialog [(open)]="editing" [heading]="…" [dirty]="formDirty">…form…</app-dialog>`
 *
 * `dirty` (optional) reports unsaved input: closing with Escape or ✕ then
 * asks "Stay / Discard changes" instead of silently dropping what was typed.
 */
@Component({
  selector: 'app-dialog',
  imports: [TranslatePipe, TooltipDirective],
  template: `
    <dialog
      #dialog
      class="app-dialog m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50"
      [attr.aria-labelledby]="headingId"
      (close)="open.set(false)"
      (cancel)="requestClose($event)"
    >
      <div class="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 [id]="headingId" class="text-lg font-semibold">{{ heading() }}</h2>
          @if (description()) {
            <p class="mt-1 text-sm text-muted-foreground">{{ description() }}</p>
          }
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [attr.aria-label]="'common.actions.close' | t"
          [appTooltip]="'common.actions.close' | t"
          (click)="requestClose()"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" class="size-5" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l10 10M15 5L5 15" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="p-5">
        @if (open()) {
          <ng-content />
        }
      </div>
    </dialog>
  `,
})
export class DialogComponent {
  private static nextId = 0;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly unsaved = inject(UnsavedChanges);

  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly description = input<string>();
  /** Returns true while the dialog's form holds unsaved input. */
  readonly dirty = input<(() => boolean) | null>(null);
  protected readonly headingId = `dialog-heading-${DialogComponent.nextId++}`;

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) element.showModal?.();
      if (!this.open() && element.open) element.close();
    });
  }

  /** Escape / ✕: closes, after confirming when there is unsaved input. */
  protected async requestClose(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.dirty()?.() && !(await this.unsaved.confirmDiscard())) return;
    this.open.set(false);
  }
}
