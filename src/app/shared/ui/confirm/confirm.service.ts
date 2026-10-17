import { Service, signal } from '@angular/core';
import type { Observable } from 'rxjs';

/** How much the action costs: `danger` (destructive), `warning` (disruptive but recoverable), `default` (a plain state change). */
export type ConfirmVariant = 'default' | 'warning' | 'danger';

/**
 * A contextual confirmation: what is about to happen, to which record, with
 * which consequence — never a bare "Are you sure?". The confirm button names
 * the exact action ("Deactivate Employee", "Delete Ticket"), never "Yes" / "OK".
 */
export interface ConfirmRequest {
  /** The action and the record, e.g. "Deactivate Ahmed Hassan?". */
  heading: string;
  /** What happens, in one or two sentences. */
  message: string;
  /** Further consequences, one per line (sessions ended, data kept …). */
  details?: readonly string[];
  /** Adds "This action cannot be undone." — for permanent changes only. */
  irreversible?: boolean;
  /** The exact action, e.g. "Deactivate Employee". */
  confirmLabel: string;
  cancelLabel: string;
  variant?: ConfirmVariant;
  /** @deprecated use `variant`; `destructive` = `danger`. */
  tone?: 'default' | 'destructive';
  /** High-risk actions: the confirm button stays disabled until exactly this text is typed (e.g. "DELETE"). */
  requireText?: string;
  /**
   * Runs when the user confirms, while the dialog shows its progress: the
   * dialog closes only once it succeeds; on failure it stays open with the
   * error, so nothing looks done that is not. Cannot be confirmed twice.
   */
  action?: () => Observable<unknown> | Promise<unknown>;
}

interface PendingConfirm extends ConfirmRequest {
  variant: ConfirmVariant;
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based confirmation rendered by the shell's `<app-confirm-host>`
 * (one native modal dialog: focus trapped, Escape = cancel, focus returned
 * to the control that opened it). `confirm()` resolves true once the user
 * confirmed — and, with an `action`, once that action succeeded — false when
 * they cancelled. Concurrent requests share the open dialog's answer rather
 * than stacking dialogs. A UI affordance only: the API authorizes every action.
 */
@Service()
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);
  /** The action of the open dialog is running (buttons disabled, Escape ignored). */
  readonly running = signal(false);
  /** Why the open dialog's action failed (already translated by the host). */
  readonly failure = signal<unknown>(null);
  private queue: Array<(confirmed: boolean) => void> = [];

  confirm(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this.pending()) {
        this.queue.push(resolve);
        return;
      }
      this.failure.set(null);
      this.pending.set({ ...request, variant: request.variant ?? (request.tone === 'destructive' ? 'danger' : 'default'), resolve });
    });
  }

  /** Called by the dialog host: cancel, or confirm (running the action first, when there is one). */
  async answer(confirmed: boolean): Promise<void> {
    const current = this.pending();
    if (!current || this.running()) return;
    if (confirmed && current.action) {
      this.running.set(true);
      this.failure.set(null);
      try {
        const result = current.action();
        await (isObservable(result) ? lastValue(result) : result);
      } catch (error) {
        this.failure.set(error ?? new Error('failed'));
        return;
      } finally {
        this.running.set(false);
      }
    }
    this.pending.set(null);
    this.failure.set(null);
    current.resolve(confirmed);
    for (const waiting of this.queue.splice(0)) waiting(confirmed);
  }
}

function isObservable(value: unknown): value is Observable<unknown> {
  return !!value && typeof (value as Observable<unknown>).subscribe === 'function';
}

/** Completes with the observable (an HTTP call emits once); errors reject. */
function lastValue(source: Observable<unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    source.subscribe({ error: reject, complete: () => resolve() });
  });
}
