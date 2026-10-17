import { Directive, ElementRef, inject, input } from '@angular/core';

import { type ContextMenuItem, ContextMenuService } from './context-menu.service';

/** How long a touch must rest to open the menu (and how far it may wander). */
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;

/**
 * `[appContextMenu]="actions"` — a function returning the actions the user may
 * perform on this element right now. Opens the app's context menu on
 * right-click, on a long press (touch), and on the keyboard's menu key /
 * Shift+F10. With no actions nothing opens and the browser keeps its own
 * menu: its default is prevented only where the custom menu actually opens.
 */
@Directive({
  selector: '[appContextMenu]',
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(keydown)': 'onKeydown($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'cancelPress()',
    '(pointercancel)': 'cancelPress()',
    '(click)': 'onClick($event)',
  },
})
export class ContextMenuDirective {
  private readonly menu = inject(ContextMenuService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly appContextMenu = input.required<() => readonly ContextMenuItem[]>();
  /** What the menu is for, for screen readers. */
  readonly contextMenuLabel = input('');

  private press: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
  /** A long press just opened the menu: the click its release produces must not also activate the element (a link). */
  private swallowClickUntil = 0;

  protected onContextMenu(event: MouseEvent): void {
    this.cancelPress();
    if (this.menu.openAt(this.appContextMenu()(), event.clientX, event.clientY, this.host.nativeElement, this.contextMenuLabel())) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    if (this.menu.openFrom(this.appContextMenu()(), this.host.nativeElement, this.contextMenuLabel())) event.preventDefault();
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    this.cancelPress();
    const { clientX: x, clientY: y } = event;
    this.press = {
      x,
      y,
      timer: setTimeout(() => {
        this.press = null;
        if (this.menu.openAt(this.appContextMenu()(), x, y, this.host.nativeElement, this.contextMenuLabel())) {
          this.swallowClickUntil = Date.now() + 800;
          navigator.vibrate?.(10);
        }
      }, LONG_PRESS_MS),
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > LONG_PRESS_SLOP_PX) this.cancelPress();
  }

  protected cancelPress(): void {
    if (!this.press) return;
    clearTimeout(this.press.timer);
    this.press = null;
  }

  protected onClick(event: MouseEvent): void {
    if (Date.now() >= this.swallowClickUntil) return;
    this.swallowClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
  }
}
