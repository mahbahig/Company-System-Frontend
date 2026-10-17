import { Service, signal } from '@angular/core';

/** How a toast reads. */
export type ToastTone = 'info' | 'warning';

/** A short-lived message in the corner of the screen. */
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message: string;
}

/** How long a toast stays unless dismissed. */
const TOAST_MS = 10_000;
/** At most this many at once (the oldest goes first). */
const MAX_TOASTS = 3;

/**
 * Toasts: something that just happened, said once in the corner (the system
 * locked by another Super Administrator …). Presentation only — what must be
 * kept goes through the notification center, never only here.
 */
@Service()
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(toast: Omit<Toast, 'id'>): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { ...toast, id }].slice(-MAX_TOASTS));
    setTimeout(() => this.dismiss(id), TOAST_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
