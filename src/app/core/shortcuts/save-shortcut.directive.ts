import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { KeyboardShortcuts } from './keyboard-shortcuts.service';

/**
 * `<form appSaveShortcut …>`: Ctrl/⌘+S submits the form through its own
 * enabled submit button — exactly what clicking Save does (same validation,
 * same busy state, same request), and nothing while Save is disabled or
 * absent. Overrides the browser's "Save page" only while the form is shown.
 */
@Directive({ selector: 'form[appSaveShortcut]' })
export class SaveShortcutDirective {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const unregister = this.shortcuts.register({
        id: `save-shortcut-${SaveShortcutDirective.nextId++}`,
        keys: 'mod+s',
        group: 'page',
        label: () => this.i18n.t('ux.shortcuts.save'),
        allowInInput: true,
        run: () => this.submit(),
      });
      this.destroyRef.onDestroy(unregister);
    });
  }

  private submit(): void {
    const form = this.host.nativeElement;
    if (!form.isConnected) return;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]:not(:disabled)');
    if (!submit) return;
    form.requestSubmit(submit);
  }
}
