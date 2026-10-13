import { OrthographicCamera, Scene, Timer, WebGLRenderer } from 'three';

import type { SceneTheme } from '../solar-scene/scene-theme.type';
import { MeteorShower } from './meteor-shower';
import { StarField } from './star-field';
import type { StarSkyOptions } from './star-sky-options.interface';
import { STAR_SKY } from './star-sky.config';

/**
 * The sky behind the whole sign-in page — twinkling stars and random meteors
 * — framework-free, so the Angular wrapper only handles lifecycle and DOM
 * events. Drawn flat in CSS pixels through an orthographic camera.
 *
 * - Reduced motion holds the stars still, sends no meteors and renders only
 *   when something changes (size, theme).
 * - `setTheme()` redraws it for the app theme (daylight or night) in place.
 * - `dispose()` releases every GPU resource and the WebGL context itself.
 */
export class StarSky {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  /** y points up from the bottom edge; one unit is one CSS pixel. */
  private readonly camera = new OrthographicCamera(0, 1, 1, 0, -1, 1);
  private readonly stars: StarField;
  private readonly meteors: MeteorShower;
  private readonly timer = new Timer();

  private reducedMotion: boolean;
  /** Twinkle clock; frozen under reduced motion. */
  private elapsed: number = STAR_SKY.stars.restTime;
  private lastFrameTime = 0;
  private needsRender = true;
  private rendered = false;
  private frame = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly options: StarSkyOptions,
  ) {
    const look = STAR_SKY.looks[options.theme];
    this.reducedMotion = options.reducedMotion;

    // Transparent and flat: the page's CSS sky shows through, and nothing
    // here needs depth testing or antialiasing (every edge is soft).
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false });
    this.renderer.debug.checkShaderErrors = options.checkShaders;
    const pixelRatio = Math.min(options.pixelRatio, STAR_SKY.renderer.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x000000, 0);

    this.stars = new StarField(pixelRatio, look);
    this.meteors = new MeteorShower(look);
    this.scene.add(this.stars.object, this.meteors.object);

    this.timer.connect(canvas.ownerDocument);
    this.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  }

  start(): void {
    if (this.frame) return;
    this.timer.reset();
    this.frame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.renderer.setSize(w, h, false);
    this.camera.right = w;
    this.camera.top = h;
    this.camera.updateProjectionMatrix();
    this.stars.setSize(w, h);
    this.meteors.setSize(w, h);
    this.needsRender = true;
  }

  setTheme(theme: SceneTheme): void {
    const look = STAR_SKY.looks[theme];
    this.stars.setLook(look);
    this.meteors.setLook(look);
    this.needsRender = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.needsRender = true;
  }

  dispose(): void {
    this.stop();
    this.timer.dispose();
    this.stars.dispose();
    this.meteors.dispose();
    this.renderer.dispose();
    // Free the context now rather than whenever the canvas is garbage-collected.
    this.renderer.forceContextLoss();
  }

  private readonly tick = (timestamp: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (timestamp - this.lastFrameTime < STAR_SKY.renderer.minFrameInterval) return;
    this.lastFrameTime = timestamp;

    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), STAR_SKY.renderer.maxFrameDelta);
    const animate = !this.reducedMotion;
    // Under reduced motion nothing changes on its own: skip idle frames.
    if (!animate && !this.needsRender) return;
    this.needsRender = false;

    if (animate) this.elapsed += delta;
    this.stars.update(this.elapsed);
    this.meteors.update(delta, animate);
    this.renderer.render(this.scene, this.camera);
    if (!this.rendered) {
      this.rendered = true;
      this.options.onFirstFrame();
    }
  };
}
