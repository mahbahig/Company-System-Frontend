import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { KeyboardShortcuts } from './keyboard-shortcuts.service';

/**
 * Binds a page-level shortcut to the control it decorates:
 * `<a appButton routerLink="new" appShortcut="n">New customer</a>`.
 *
 * The shortcut exists exactly as long as the control is rendered and simply
 * clicks it, so it inherits the control's permission check (`@if (auth.can…)`)
 * and behaviour — it can never reach an action the visible UI hides. A
 * disabled control is not clicked. Never use it on a destructive action.
 */
@Directive({
  selector: '[appShortcut]',
  host: { '[attr.aria-keyshortcuts]': 'ariaKeys()' },
})
export class ShortcutDirective {
  private static nextId = 0;

  readonly keys = input.required<string>({ alias: 'appShortcut' });
  /** Help-dialog text; defaults to the control's own text. */
  readonly label = input<string>('', { alias: 'appShortcutLabel' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = `page-shortcut-${ShortcutDirective.nextId++}`;

  constructor() {
    // After render, so the default label (the control's text) is in the DOM.
    afterNextRender(() => {
      const element = this.host.nativeElement;
      const unregister = this.shortcuts.register({
        id: this.id,
        keys: this.keys(),
        group: 'page',
        label: () => this.label() || element.textContent?.trim() || this.i18n.t('ux.shortcuts.pageAction'),
        run: () => {
          if (!element.isConnected || element.matches(':disabled, [aria-disabled="true"]')) return;
          element.click();
        },
      });
      this.destroyRef.onDestroy(unregister);
    });
  }

  protected ariaKeys(): string {
    return this.keys()
      .split(' ')
      .map((step) => step.replace('mod+', this.shortcuts.isMac ? 'Meta+' : 'Control+'))
      .join(' ');
  }
}
