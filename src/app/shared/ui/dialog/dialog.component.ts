import { Component, ElementRef, effect, inject, input, model, viewChild } from '@angular/core';

import { UnsavedChanges } from '../../../core/forms/unsaved-changes';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TooltipDirective } from '../tooltip/tooltip.directive';

/**
 * Modal dialog on the native `<dialog>` element: `showModal()` gives a real
 * focus trap, Escape-to-close and an inert background without extra code.
 * The header (title and ✕) stays at the top while a long body scrolls inside
 * the dialog — never the page behind it.
 * `<app-dialog [(open)]="editing" [heading]="…" [dirty]="formDirty">…form…</app-dialog>`
 *
 * `dirty` (optional) reports unsaved input: closing with Escape or ✕ then
 * asks "Stay / Discard changes" instead of silently dropping what was typed.
 */
@Component({
  selector: 'app-dialog',
  imports: [TranslatePipe, TooltipDirective],
  templateUrl: './dialog.component.html',
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
