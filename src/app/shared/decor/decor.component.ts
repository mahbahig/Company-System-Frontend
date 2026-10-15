import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import type { DecorAlign } from './decor-align.type';
import type { DecorComposition } from './decor-composition.type';
import { DecorStage } from './decor-stage';

/** Below this viewport width, or on a touch screen, pieces are built lighter. */
const COMPACT_QUERY = '(max-width: 767px), (pointer: coarse)';

/**
 * A decorative three.js piece — see `DECOR.compositions` — filling its host.
 * Purely ornamental: `aria-hidden`, never takes pointer events, and the page
 * works the same without it (no WebGL simply means no canvas). It follows
 * the app theme and text direction, pauses whenever it is off-screen,
 * respects reduced motion, and on destroy releases every listener and GPU
 * resource, WebGL context included.
 *
 * Load it inside `@defer` so three.js stays out of the page's own bundle.
 */
@Component({
  selector: 'app-decor',
  templateUrl: './decor.component.html',
  host: { class: 'pointer-events-none block select-none', 'aria-hidden': 'true' },
})
export class DecorComponent {
  readonly composition = input.required<DecorComposition>();
  readonly align = input<DecorAlign>('center');
  /** Let the piece lean very slightly towards the mouse. */
  readonly interactive = input(true);

  protected readonly visible = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService).resolved;
  private readonly rtl = inject(I18nService).isRtl;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stage: DecorStage | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.mount()));
    // Read the signals unconditionally so the effects track them before the stage exists.
    effect(() => {
      const theme = this.theme();
      this.stage?.setTheme(theme);
    });
    effect(() => {
      const rtl = this.rtl();
      this.stage?.setDirection(rtl);
    });
  }

  /** Creates the stage and its DOM wiring; returns the matching teardown. */
  private mount(): () => void {
    const view = this.document.defaultView;
    if (!view) return () => undefined;
    const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');

    let stage: DecorStage;
    try {
      stage = new DecorStage(this.canvas().nativeElement, {
        composition: this.composition(),
        align: this.align(),
        theme: this.theme(),
        rtl: this.rtl(),
        pixelRatio: view.devicePixelRatio,
        compact: view.matchMedia(COMPACT_QUERY).matches,
        reducedMotion: reducedMotion.matches,
        checkShaders: isDevMode(),
        onFirstFrame: () => this.visible.set(true),
      });
    } catch {
      // No WebGL: the surface around the piece already stands on its own.
      return () => undefined;
    }
    this.stage = stage;

    const resize = new ResizeObserver(([entry]) =>
      stage.setSize(entry.contentRect.width, entry.contentRect.height),
    );
    resize.observe(this.host.nativeElement);

    // Never render while scrolled out of view.
    const visibility = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? stage.start() : stage.stop(),
    );
    visibility.observe(this.host.nativeElement);

    const onMotionChange = (event: MediaQueryListEvent): void =>
      stage.setReducedMotion(event.matches);
    reducedMotion.addEventListener('change', onMotionChange);

    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse') return;
      stage.setPointer(
        (event.clientX / view.innerWidth) * 2 - 1,
        -((event.clientY / view.innerHeight) * 2 - 1),
      );
    };
    const onPointerLeave = (): void => stage.setPointer(0, 0);
    const parallax = this.interactive() && finePointer.matches;
    if (parallax) {
      this.document.addEventListener('pointermove', onPointerMove, { passive: true });
      this.document.documentElement.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      resize.disconnect();
      visibility.disconnect();
      reducedMotion.removeEventListener('change', onMotionChange);
      if (parallax) {
        this.document.removeEventListener('pointermove', onPointerMove);
        this.document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      }
      this.stage = null;
      stage.dispose();
    };
  }
}
