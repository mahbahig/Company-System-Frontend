import { Component, DOCUMENT, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { type ContextMenuItem, ContextMenuService } from './context-menu.service';

/** Space kept between the menu and the viewport's edges. */
const EDGE = 8;

/**
 * Renders the open context menu (one per app, in the shell): at the pointer,
 * kept inside the viewport (flipped above / to the other side when it would
 * overflow, the inline direction following the page's), focus on its first
 * action, arrow keys / Home / End to move, Enter or Space to choose, Escape,
 * Tab, a click elsewhere, scrolling or resizing to close. Popover colours and
 * border, so it reads as part of the UI in both themes.
 */
@Component({
  selector: 'app-context-menu-host',
  imports: [IconComponent],
  template: `
    @if (service.menu(); as open) {
      <div
        #panel
        role="menu"
        tabindex="-1"
        data-testid="context-menu"
        class="fixed z-[70] min-w-44 max-w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none animate-tooltip-in"
        [attr.aria-label]="open.label"
        [style.left.px]="position().left"
        [style.top.px]="position().top"
        [style.visibility]="position().measured ? 'visible' : 'hidden'"
        (keydown)="onKeydown($event)"
        (contextmenu)="$event.preventDefault()"
      >
        @for (item of open.items; track item.id) {
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-start outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary disabled:opacity-50"
            [class.text-destructive-tint]="item.destructive"
            [attr.data-testid]="'menu-item-' + item.id"
            (click)="service.choose(item)"
          >
            @if (item.icon) {
              <app-icon [icon]="item.icon" svgClass="size-4 shrink-0" />
            }
            <span class="truncate">{{ item.label }}</span>
          </button>
        }
      </div>
    }
  `,
  host: {
    '(document:pointerdown)': 'onPointerDown($event)',
    '(document:keydown.escape)': 'service.close()',
    '(window:resize)': 'service.close(false)',
    '(window:blur)': 'service.close(false)',
    '(document:scroll)': 'onScroll($event)',
  },
})
export class ContextMenuHostComponent {
  protected readonly service = inject(ContextMenuService);
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  protected readonly position = signal({ left: 0, top: 0, measured: false });

  constructor() {
    // Measure once rendered (read), keep inside the viewport and focus the first action (write).
    afterRenderEffect({
      earlyRead: () => {
        const open = this.service.menu();
        const panel = this.panel()?.nativeElement;
        if (!open || !panel) return null;
        // Layout size, not the box: the opening animation scales the panel.
        const { offsetWidth: width, offsetHeight: height } = panel;
        const root = this.document.documentElement;
        return { open, width, height, viewportWidth: root.clientWidth, viewportHeight: root.clientHeight, rtl: root.dir === 'rtl' };
      },
      write: (geometry) => {
        const measured = geometry();
        if (!measured) {
          if (this.position().measured) this.position.set({ left: 0, top: 0, measured: false });
          return;
        }
        const { open, width, height, viewportWidth, viewportHeight, rtl } = measured;
        // Towards the reading direction from a pointer; lined up with a control's inline end; flipped when it would not fit.
        const before = rtl === (open.align === 'start');
        let left = before ? open.x - width : open.x;
        if (left < EDGE) left = open.x;
        if (left + width > viewportWidth - EDGE) left = Math.min(open.x - width, viewportWidth - width - EDGE);
        let top = open.y;
        if (top + height > viewportHeight - EDGE) top = open.y - height;
        const next = { left: Math.max(EDGE, Math.round(left)), top: Math.max(EDGE, Math.round(top)), measured: true };
        const current = this.position();
        if (current.measured && current.left === next.left && current.top === next.top) return;
        this.position.set(next);
        if (!current.measured) this.items()[0]?.focus({ preventScroll: true });
      },
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    const panel = this.panel()?.nativeElement;
    const target = event.target as Node;
    if (!panel || panel.contains(target)) return;
    // Its own "⋯" button toggles it (on click); anything else closes it.
    const origin = this.service.menu()?.origin;
    if (origin?.hasAttribute('aria-haspopup') && origin.contains(target)) return;
    this.service.close(false);
  }

  protected onScroll(event: Event): void {
    const panel = this.panel()?.nativeElement;
    if (panel && !panel.contains(event.target as Node)) this.service.close(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(this.document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index < 0 ? items.length - 1 : index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Tab') this.service.close();
  }

  private items(): HTMLButtonElement[] {
    return [...(this.panel()?.nativeElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  }
}

export type { ContextMenuItem };
