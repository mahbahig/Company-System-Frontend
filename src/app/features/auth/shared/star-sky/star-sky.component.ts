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

import type { SceneTheme } from '../solar-scene/scene-theme.type';
import { StarSky } from './star-sky';

/**
 * Hosts the Three.js {@link StarSky} on a canvas and ties it to Angular's
 * lifecycle: it sizes the sky to its host, follows the app theme and the
 * reduced-motion preference, and on destroy disposes every listener and GPU
 * resource, WebGL context included. Purely decorative (`aria-hidden`) and
 * never interactive.
 *
 * Load it inside `@defer` so three.js stays out of the route's initial bundle.
 */
@Component({
  selector: 'app-star-sky',
  templateUrl: './star-sky.component.html',
  host: { class: 'block', 'aria-hidden': 'true' },
})
export class StarSkyComponent {
  /** The resolved app theme; the sky redraws in place when it changes. */
  readonly theme = input.required<SceneTheme>();

  protected readonly visible = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private sky: StarSky | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.mount()));
    // Read the signal unconditionally so the effect tracks it before the sky exists.
    effect(() => {
      const theme = this.theme();
      this.sky?.setTheme(theme);
    });
  }

  /** Creates the sky and its DOM wiring; returns the matching teardown. */
  private mount(): () => void {
    const view = this.document.defaultView;
    if (!view) return () => undefined;
    const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');

    let sky: StarSky;
    try {
      sky = new StarSky(this.canvas().nativeElement, {
        theme: this.theme(),
        pixelRatio: view.devicePixelRatio,
        reducedMotion: reducedMotion.matches,
        checkShaders: isDevMode(),
        onFirstFrame: () => this.visible.set(true),
      });
    } catch {
      // No WebGL: the page's CSS sky stands on its own.
      return () => undefined;
    }
    this.sky = sky;

    const resize = new ResizeObserver(([entry]) =>
      sky.setSize(entry.contentRect.width, entry.contentRect.height),
    );
    resize.observe(this.host.nativeElement);

    const onMotionChange = (event: MediaQueryListEvent): void =>
      sky.setReducedMotion(event.matches);
    reducedMotion.addEventListener('change', onMotionChange);

    sky.start();

    return () => {
      resize.disconnect();
      reducedMotion.removeEventListener('change', onMotionChange);
      this.sky = null;
      sky.dispose();
    };
  }
}
