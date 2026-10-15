import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { KeyboardShortcuts, type ShortcutGroup } from './keyboard-shortcuts.service';

const GROUP_ORDER: ShortcutGroup[] = ['general', 'navigation', 'page'];

/**
 * `?` — lists the shortcuts available to this user on this page right now
 * (navigation only for pages the role can open, page actions only when the
 * page shows them), so the list itself never advertises a forbidden action.
 */
@Component({
  selector: 'app-shortcuts-help',
  imports: [TranslatePipe],
  templateUrl: './shortcuts-help.component.html',
})
export class ShortcutsHelpComponent {
  protected readonly shortcuts = inject(KeyboardShortcuts);
  private readonly i18n = inject(I18nService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly groups = computed(() => {
    this.i18n.locale();
    const all = this.shortcuts.all();
    return GROUP_ORDER.map((id) => ({ id, items: all.filter((shortcut) => shortcut.group === id) })).filter((group) => group.items.length);
  });

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.shortcuts.helpOpen() && !element.open) element.showModal?.();
      if (!this.shortcuts.helpOpen() && element.open) element.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.shortcuts.helpOpen.set(false);
  }
}
