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
  templateUrl: './confirm-host.component.html',
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
