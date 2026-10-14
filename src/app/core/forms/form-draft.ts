import { DestroyRef, effect, inject, signal, untracked, type Signal, type WritableSignal } from '@angular/core';

import { DraftStore } from './draft-store.service';

const AUTOSAVE_DELAY_MS = 800;

export interface FormDraftOptions {
  /** Drafts are kept only while this is true (e.g. create mode, not read-only). */
  enabled: () => boolean;
  /** Only user changes are saved (not the initial or prefilled values). */
  dirty: () => boolean;
}

/**
 * Local draft for one long form: autosaves the model (debounced) while the
 * user edits, offers a draft left from an interrupted visit, and is cleared
 * after a successful save. Create in an injection context:
 * `protected readonly draft = new FormDraft('lead.new', this.model, { … })`.
 */
export class FormDraft<T> {
  private readonly drafts = inject(DraftStore);

  /** A draft from an earlier visit, waiting for "Restore" or "Discard". */
  readonly offered = signal<{ savedAt: number } | null>(null);
  /** When this visit's input was last saved as a draft. */
  readonly savedAt = signal<number | null>(null);
  private readonly pendingValue = signal<T | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly formKey: string,
    private readonly model: WritableSignal<T> | Signal<T>,
    private readonly options: FormDraftOptions,
  ) {
    const existing = this.drafts.read<T>(formKey);
    if (existing && options.enabled()) {
      this.offered.set({ savedAt: existing.savedAt });
      this.pendingValue.set(existing.value);
    }

    effect(() => {
      const value = this.model();
      if (!this.options.enabled() || !this.options.dirty()) return;
      // While an earlier draft is on offer, typing must not overwrite it silently.
      if (untracked(() => this.offered())) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.savedAt.set(this.drafts.write(this.formKey, value)), AUTOSAVE_DELAY_MS);
    });
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  /** Refills the form with the offered draft. */
  restore(apply: (value: T) => void): void {
    const value = this.pendingValue();
    if (value !== null) apply(value);
    this.offered.set(null);
    this.pendingValue.set(null);
  }

  /** Throws the offered draft away. */
  discard(): void {
    this.drafts.clear(this.formKey);
    this.offered.set(null);
    this.pendingValue.set(null);
  }

  /** After a successful save. */
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.drafts.clear(this.formKey);
    this.savedAt.set(null);
  }
}
