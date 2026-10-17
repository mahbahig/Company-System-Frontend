import { Service, signal } from '@angular/core';
import type { IconNode } from 'lucide';

/** One action of a context menu. Only actions the user may perform are ever listed (the API decides; the menu mirrors it). */
export interface ContextMenuItem {
  /** Stable id (`data-testid="menu-item-<id>"`). */
  id: string;
  label: string;
  icon?: IconNode;
  /** Deletes or otherwise destroys something: drawn in the destructive colour. */
  destructive?: boolean;
  run: () => unknown;
}

export interface OpenContextMenu {
  items: readonly ContextMenuItem[];
  /** Where it was asked for (viewport coordinates); the host keeps it inside the viewport. */
  x: number;
  y: number;
  /** What the menu is for, for screen readers ("Message actions"). */
  label: string;
  /** Gets focus back when the menu closes. */
  origin: HTMLElement | null;
  /** `start`: begins at the point (a pointer); `end`: its inline end lines up with the point (a control's edge). */
  align: 'start' | 'end';
}

/**
 * The one context menu of the app, rendered by the shell's
 * `<app-context-menu-host>`: opened at the pointer (right-click, long-press —
 * `appContextMenu`) or beside a control (an overflow "⋯" button, the keyboard's
 * menu key). One at a time; closes on an action, Escape, a click elsewhere,
 * scrolling or resizing. A UI affordance only: the API authorizes every action.
 */
@Service()
export class ContextMenuService {
  readonly menu = signal<OpenContextMenu | null>(null);

  /** Opens at a point. False (nothing opened) when there is nothing the user may do — the caller then leaves the browser's own menu alone. */
  openAt(items: readonly ContextMenuItem[], x: number, y: number, origin: HTMLElement | null, label: string, align: 'start' | 'end' = 'start'): boolean {
    if (!items.length) return false;
    this.menu.set({ items, x, y, origin, label, align });
    return true;
  }

  /** Opens beside a control: below it, aligned with its inline end (the host flips it when there is no room). */
  openFrom(items: readonly ContextMenuItem[], origin: HTMLElement, label: string): boolean {
    const box = origin.getBoundingClientRect();
    const rtl = getComputedStyle(origin).direction === 'rtl';
    return this.openAt(items, rtl ? box.left : box.right, box.bottom + 4, origin, label, 'end');
  }

  /** The "⋯" button: opens its menu, or closes it when it is the one open. */
  toggleFrom(items: readonly ContextMenuItem[], origin: HTMLElement, label: string): boolean {
    if (this.menu()?.origin === origin) {
      this.close();
      return false;
    }
    return this.openFrom(items, origin, label);
  }

  close(restoreFocus = true): void {
    const open = this.menu();
    if (!open) return;
    this.menu.set(null);
    if (restoreFocus && open.origin?.isConnected) open.origin.focus({ preventScroll: true });
  }

  /** Runs an action: the menu closes first (focus back where it came from), then the action — which may open a confirmation. */
  choose(item: ContextMenuItem): void {
    this.close();
    item.run();
  }
}
