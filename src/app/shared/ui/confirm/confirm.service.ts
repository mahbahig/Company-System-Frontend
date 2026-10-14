import { Service, signal } from '@angular/core';

export interface ConfirmRequest {
  heading: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** `destructive` styles the confirm button as a destructive action. */
  tone?: 'default' | 'destructive';
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based confirmation rendered by the shell's `<app-confirm-host>`
 * (one native modal dialog: focus trapped, Escape = cancel). Concurrent
 * requests share the open dialog's answer rather than stacking dialogs.
 */
@Service()
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);
  private queue: Array<(confirmed: boolean) => void> = [];

  confirm(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this.pending()) {
        this.queue.push(resolve);
        return;
      }
      this.pending.set({ ...request, resolve });
    });
  }

  /** Called by the dialog host. */
  answer(confirmed: boolean): void {
    const current = this.pending();
    if (!current) return;
    this.pending.set(null);
    current.resolve(confirmed);
    for (const waiting of this.queue.splice(0)) waiting(confirmed);
  }
}
