import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { ButtonDirective } from '../button/button.directive';
import { ConfirmService } from './confirm.service';

/**
 * Renders `ConfirmService` requests as an `alertdialog` on the native
 * `<dialog>` element. The safe choice ("Stay") is focused first, so Enter
 * never discards work by accident; Escape and the backdrop also cancel.
 */
@Component({
  selector: 'app-confirm-host',
  imports: [ButtonDirective],
  template: `
    <dialog
      #dialog
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-heading"
      aria-describedby="confirm-message"
      class="app-dialog m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      (cancel)="$event.preventDefault(); confirm.answer(false)"
      (click)="onBackdrop($event)"
    >
      @if (confirm.pending(); as request) {
        <div class="flex flex-col gap-2 p-5">
          <h2 id="confirm-heading" class="text-base font-semibold">{{ request.heading }}</h2>
          <p id="confirm-message" class="text-sm text-muted-foreground">{{ request.message }}</p>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <button #cancel type="button" appButton variant="outline" (click)="confirm.answer(false)">{{ request.cancelLabel }}</button>
          <button type="button" appButton [variant]="request.tone === 'destructive' ? 'destructive' : 'default'" (click)="confirm.answer(true)">
            {{ request.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>('cancel');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const open = !!this.confirm.pending();
      if (open && !element.open) {
        element.showModal();
        queueMicrotask(() => this.cancel()?.nativeElement.focus());
      }
      if (!open && element.open) element.close();
    });
  }

  /** A click on the backdrop (the dialog element itself, outside its content) cancels. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.confirm.answer(false);
  }
}
