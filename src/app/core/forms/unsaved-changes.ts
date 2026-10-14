import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, inject, type Signal } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { I18nService } from '../i18n/i18n.service';

/** A routed page with editable input. */
export interface HasUnsavedChanges {
  /** True only when the user changed something that is not saved yet. */
  hasUnsavedChanges(): boolean;
}

/**
 * Protects typed-in work: the route guard below asks before leaving a page
 * whose form is dirty, and `beforeunload` covers closing the tab, reloading
 * or typing another address. Pages register their dirty check with
 * `track()`; nothing is asked when nothing changed, and a page reports
 * clean right after it saves, so the save's own navigation is not blocked.
 */
@Service()
export class UnsavedChanges {
  private readonly confirmService = inject(ConfirmService);
  private readonly i18n = inject(I18nService);
  private readonly checks = new Set<() => boolean>();

  constructor() {
    inject(DOCUMENT).defaultView?.addEventListener('beforeunload', (event) => {
      if (!this.any()) return;
      event.preventDefault();
      // Legacy browsers need a returnValue to show their (fixed-text) prompt.
      event.returnValue = '';
    });
  }

  /** Registers a page's dirty check for the lifetime of the page. */
  track(dirty: Signal<boolean> | (() => boolean), destroyRef: DestroyRef = inject(DestroyRef)): void {
    const check = () => dirty();
    this.checks.add(check);
    destroyRef.onDestroy(() => this.checks.delete(check));
  }

  any(): boolean {
    return [...this.checks].some((check) => check());
  }

  /** "Stay" (false) or "Discard changes" (true). */
  confirmDiscard(): Promise<boolean> {
    return this.confirmService.confirm({
      heading: this.i18n.t('ux.unsaved.title'),
      message: this.i18n.t('ux.unsaved.message'),
      confirmLabel: this.i18n.t('ux.unsaved.discard'),
      cancelLabel: this.i18n.t('ux.unsaved.stay'),
      tone: 'destructive',
    });
  }
}

/** `canDeactivate: [unsavedChangesGuard]` on every routed form page. */
export const unsavedChangesGuard: CanDeactivateFn<Partial<HasUnsavedChanges>> = (component) => {
  if (!component?.hasUnsavedChanges?.()) return true;
  return inject(UnsavedChanges).confirmDiscard();
};
