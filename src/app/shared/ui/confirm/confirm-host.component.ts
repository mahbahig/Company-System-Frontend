import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CircleAlert, Info, TriangleAlert } from 'lucide';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonDirective } from '../button/button.directive';
import { IconComponent } from '../icon/icon.component';
import { ConfirmService } from './confirm.service';

/**
 * Renders `ConfirmService` requests as an `alertdialog` on the native
 * `<dialog>` element: the action and the record as the title, what happens
 * as the description, the consequences, and a confirm button named after
 * the action and styled by its risk (danger / warning / default). The safe
 * choice is focused first (or the confirmation text field when one is
 * required), so Enter never confirms by accident; Escape and the backdrop
 * cancel — except while the action runs. Focus returns to the control that
 * opened the dialog.
 */
@Component({
  selector: 'app-confirm-host',
  imports: [ButtonDirective, IconComponent, TranslatePipe],
  templateUrl: './confirm-host.component.html',
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>('cancel');
  private readonly typed = viewChild<ElementRef<HTMLInputElement>>('typed');
  protected readonly icons = { danger: CircleAlert, warning: TriangleAlert, default: Info };

  /** What the user typed into the confirmation field (high-risk actions). */
  protected readonly typedText = signal('');
  protected readonly canConfirm = computed(() => {
    const request = this.confirm.pending();
    return !!request && !this.confirm.running() && (!request.requireText || this.typedText() === request.requireText);
  });
  protected readonly failureText = computed(() => {
    const failure = this.confirm.failure();
    return failure ? this.i18n.errorText(failure) : null;
  });
  private returnFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const request = this.confirm.pending();
      if (request && !element.open) {
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.typedText.set('');
        element.showModal?.();
        queueMicrotask(() => (request.requireText ? this.typed() : this.cancel())?.nativeElement.focus());
      }
      if (!request && element.open) {
        element.close();
        const target = this.returnFocus;
        this.returnFocus = null;
        if (target?.isConnected) queueMicrotask(() => target.focus());
      }
    });
  }

  protected onCancelEvent(event: Event): void {
    event.preventDefault();
    void this.confirm.answer(false);
  }

  /** A click on the backdrop (the dialog element itself, outside its content) cancels. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) void this.confirm.answer(false);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canConfirm()) void this.confirm.answer(true);
  }
}
