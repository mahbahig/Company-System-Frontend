import { AriaDescriber } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  type ConnectedPosition,
  type OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, Directive, ElementRef, Injector, afterRenderEffect, booleanAttribute, inject, input, type ComponentRef } from '@angular/core';

import { TooltipPanelComponent } from './tooltip-panel.component';

export type TooltipSide = 'top' | 'bottom' | 'start' | 'end';

/** Hover intent: a pointer passing over a toolbar does not flash every tooltip. */
const SHOW_DELAY_MS = 350;
const GAP_PX = 6;

/**
 * `<button appTooltip="Close" …>` — a short explanation shown on mouse hover
 * and keyboard focus (never on touch, where it would fight the tap), hidden on
 * leave, blur, press or Escape. The text is also exposed to assistive tech
 * through `aria-describedby` unless it merely repeats the control's own
 * accessible name, so a tooltip is never the only place information lives.
 *
 * A disabled `<button>` gets no pointer events: put the tooltip on a wrapper.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(pointerenter)': 'onPointerEnter($event)',
    '(pointerleave)': 'hide()',
    '(focusin)': 'onFocus()',
    '(focusout)': 'hide()',
    '(pointerdown)': 'hide()',
    '(keydown.escape)': 'hide()',
  },
})
export class TooltipDirective {
  readonly text = input<string | null | undefined>(null, { alias: 'appTooltip' });
  /** Optional bold first line (e.g. a page name above its description). */
  readonly heading = input<string | null | undefined>(null, { alias: 'appTooltipHeading' });
  readonly side = input<TooltipSide>('top', { alias: 'appTooltipSide' });
  readonly disabled = input(false, { alias: 'appTooltipDisabled', transform: booleanAttribute });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly dir = inject(Directionality, { optional: true });
  private readonly describer = inject(AriaDescriber);

  private overlayRef: OverlayRef | null = null;
  private panel: ComponentRef<TooltipPanelComponent> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private description: string | null = null;

  constructor() {
    // After render, so the host's own aria-label / text is already in the DOM.
    afterRenderEffect(() => this.syncDescription(this.active() ? this.message() : ''));
    inject(DestroyRef).onDestroy(() => {
      this.hide();
      this.overlayRef?.dispose();
      this.syncDescription('');
    });
  }

  protected onPointerEnter(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.schedule(SHOW_DELAY_MS);
  }

  protected onFocus(): void {
    // Keyboard focus only — a mouse click focusing a button should not pop a tooltip.
    let keyboard = true;
    try {
      keyboard = this.host.nativeElement.matches(':focus-visible');
    } catch {
      /* selector unsupported: treat as keyboard */
    }
    if (keyboard) this.schedule(0);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.overlayRef?.hasAttached()) this.overlayRef.detach();
    this.panel = null;
  }

  private active(): boolean {
    return !this.disabled() && !!this.message();
  }

  private message(): string {
    return [this.heading(), this.text()].filter(Boolean).join(' — ');
  }

  private schedule(delay: number): void {
    if (!this.active()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.show(), delay);
  }

  private show(): void {
    this.timer = null;
    if (!this.active() || !this.host.nativeElement.isConnected) return;
    const overlayRef = this.ensureOverlay();
    if (!overlayRef.hasAttached()) this.panel = overlayRef.attach(new ComponentPortal(TooltipPanelComponent, null, this.injector));
    this.panel?.instance.heading.set(this.heading() ?? '');
    this.panel?.instance.text.set(this.text() ?? '');
    overlayRef.updatePosition();
  }

  private ensureOverlay(): OverlayRef {
    const rtl = this.dir?.value === 'rtl';
    const strategy = createFlexibleConnectedPositionStrategy(this.injector, this.host)
      .withPositions(positionsFor(this.side(), rtl))
      .withFlexibleDimensions(false)
      .withViewportMargin(8)
      .withPush(true);
    if (this.overlayRef) {
      this.overlayRef.updatePositionStrategy(strategy);
      this.overlayRef.setDirection(rtl ? 'rtl' : 'ltr');
      return this.overlayRef;
    }
    this.overlayRef = createOverlayRef(this.injector, {
      positionStrategy: strategy,
      scrollStrategy: createRepositionScrollStrategy(this.injector, { autoClose: true }),
      direction: rtl ? 'rtl' : 'ltr',
      panelClass: 'app-tooltip-pane',
      disposeOnNavigation: true,
    });
    return this.overlayRef;
  }

  /** `aria-describedby` only when the tooltip adds something to the accessible name. */
  private syncDescription(message: string): void {
    const element = this.host.nativeElement;
    const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
    const next = message && message.trim() !== name ? message : null;
    if (next === this.description) return;
    if (this.description) this.describer.removeDescription(element, this.description);
    if (next) this.describer.describe(element, next);
    this.description = next;
  }
}

/** Preferred side first, then the opposite side as a fallback. Offsets follow the text direction. */
function positionsFor(side: TooltipSide, rtl: boolean): ConnectedPosition[] {
  const top: ConnectedPosition = { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -GAP_PX };
  const bottom: ConnectedPosition = { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: GAP_PX };
  const end: ConnectedPosition = { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: rtl ? -GAP_PX : GAP_PX };
  const start: ConnectedPosition = { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: rtl ? GAP_PX : -GAP_PX };
  switch (side) {
    case 'bottom':
      return [bottom, top];
    case 'end':
      return [end, start, top];
    case 'start':
      return [start, end, top];
    default:
      return [top, bottom];
  }
}
