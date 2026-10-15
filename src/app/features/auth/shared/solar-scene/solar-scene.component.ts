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
  output,
  signal,
  viewChild,
} from '@angular/core';

import type { SceneFraming } from './scene-framing.interface';
import type { SceneTheme } from './scene-theme.type';
import { SolarScene } from './solar-scene';

/**
 * Hosts the Three.js {@link SolarScene} on a canvas and ties it to Angular's
 * lifecycle: it sizes the scene to its host, pauses rendering while off-screen,
 * follows the app theme and the reduced-motion preference and feeds the
 * pointer parallax — and on destroy disposes every listener, observer and GPU
 * resource, WebGL context included. Purely decorative (`aria-hidden`); nothing
 * on the page depends on it.
 *
 * Load it inside `@defer` so three.js stays out of the route's initial bundle.
 */
@Component({
  selector: 'app-solar-scene',
  templateUrl: './solar-scene.component.html',
  host: { class: 'block', 'aria-hidden': 'true' },
})
export class SolarSceneComponent {
  /** Where the lockup sits in the canvas; may change with the layout breakpoint. */
  readonly framing = input.required<SceneFraming>();
  /** The resolved app theme; the scene relights in place when it changes. */
  readonly theme = input.required<SceneTheme>();
  /** The first frame is on screen. */
  readonly ready = output<void>();
  /** The user turned the sun, or rotated or zoomed the scene, for the first time. */
  readonly interacted = output<void>();

  protected readonly visible = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene: SolarScene | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.mount()));
    // Read the signals unconditionally so the effects track them before the scene exists.
    effect(() => {
      const framing = this.framing();
      this.scene?.setFraming(framing);
    });
    effect(() => {
      const theme = this.theme();
      this.scene?.setTheme(theme);
    });
  }

  /** Creates the scene and its DOM wiring; returns the matching teardown. */
  private mount(): () => void {
    const view = this.document.defaultView;
    if (!view) return () => undefined;
    const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');

    let scene: SolarScene;
    try {
      scene = new SolarScene(this.canvas().nativeElement, {
        framing: this.framing(),
        theme: this.theme(),
        pixelRatio: view.devicePixelRatio,
        reducedMotion: reducedMotion.matches,
        touchScroll: !finePointer.matches,
        checkShaders: isDevMode(),
        onFirstFrame: () => {
          this.visible.set(true);
          this.ready.emit();
        },
        onFirstInteraction: () => this.interacted.emit(),
      });
    } catch {
      // No WebGL (old GPU, disabled acceleration): the layout's static
      // backdrop already stands on its own, so the page simply goes without.
      return () => undefined;
    }
    this.scene = scene;

    const resize = new ResizeObserver(([entry]) =>
      scene.setSize(entry.contentRect.width, entry.contentRect.height),
    );
    resize.observe(this.host.nativeElement);

    // Never render while scrolled out of view (the mobile hero) or hidden.
    const visibility = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? scene.start() : scene.stop(),
    );
    visibility.observe(this.host.nativeElement);

    const onMotionChange = (event: MediaQueryListEvent): void =>
      scene.setReducedMotion(event.matches);
    reducedMotion.addEventListener('change', onMotionChange);

    const onPointerMove = (event: PointerEvent): void => {
      // Parallax follows a hovering mouse only — never a drag or a touch.
      if (event.pointerType !== 'mouse' || event.buttons !== 0) return;
      scene.setPointer(
        (event.clientX / view.innerWidth) * 2 - 1,
        (event.clientY / view.innerHeight) * 2 - 1,
      );
    };
    const onPointerLeave = (): void => scene.setPointer(0, 0);
    if (finePointer.matches) {
      this.document.addEventListener('pointermove', onPointerMove, { passive: true });
      this.document.documentElement.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      resize.disconnect();
      visibility.disconnect();
      reducedMotion.removeEventListener('change', onMotionChange);
      this.document.removeEventListener('pointermove', onPointerMove);
      this.document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      this.scene = null;
      scene.dispose();
    };
  }
}
