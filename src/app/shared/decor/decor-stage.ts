import {
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Timer,
  Vector2,
  WebGLRenderer,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { DECOR } from './decor.config';
import type { DecorLook } from './decor-look.type';
import type { DecorPiece } from './decor-piece.interface';
import type { DecorStageOptions } from './decor-stage-options.interface';
import { disposeRenderer } from './dispose-renderer';
import type { DecorTheme } from './decor-theme.type';
import { AmbientMotes } from './pieces/ambient-motes';
import { LightRibbons } from './pieces/light-ribbons';
import { SolarArray } from './pieces/solar-array';

/** Blur of the studio environment the lacquer and gold reflect. */
const ENVIRONMENT_BLUR = 0.04;
/** Below this parallax error the piece counts as settled. */
const SETTLED = 0.0005;

/**
 * Renders one decor composition on a canvas — framework-free, so the Angular
 * wrapper only handles lifecycle and DOM events. Purely decorative: it takes
 * a theme, a size and a pointer position, and knows nothing of the app.
 *
 * - The view is fitted so the canvas is always two world units tall; pieces
 *   are placed for the composition, alignment, text direction and size.
 * - Renders at most 30 fps, only while started (the wrapper stops it when
 *   the canvas scrolls out of view or the tab is hidden).
 * - Reduced motion freezes everything and renders only when something
 *   changes (size, theme).
 * - `dispose()` releases every GPU resource and the WebGL context itself.
 */
export class DecorStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  /** Everything; rises into place on the entrance. */
  private readonly root = new Group();
  /** The ribbons and motes, tilted together by the pointer parallax. */
  private readonly field = new Group();
  private readonly keyLight = new DirectionalLight();
  private readonly fillLight = new HemisphereLight();
  private readonly environment: Texture | null = null;
  private readonly array: SolarArray | null = null;
  private readonly ribbons: LightRibbons | null = null;
  private readonly motes: AmbientMotes;
  private readonly pieces: DecorPiece[];
  private readonly timer = new Timer();
  private readonly pointer = new Vector2();
  /** The eased pointer position the parallax actually shows. */
  private readonly parallax = new Vector2();

  private rtl: boolean;
  private reducedMotion: boolean;
  private width = 1;
  private height = 1;
  /** Ambient clock; frozen under reduced motion. */
  private elapsed: number = DECOR.motion.restTime;
  /** Seconds since the first frame, for the entrance. */
  private shown = 0;
  private lastFrameTime = 0;
  private needsRender = true;
  private rendered = false;
  private frame = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly options: DecorStageOptions,
  ) {
    const { renderer: config, camera, compositions, motes } = DECOR;
    const composition = compositions[options.composition];
    const look = DECOR.looks[options.theme];
    this.rtl = options.rtl;
    this.reducedMotion = options.reducedMotion;

    // Transparent: the host's CSS surface shows through, and stands on its
    // own if WebGL is unavailable.
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.debug.checkShaderErrors = options.checkShaders;
    const pixelRatio = Math.min(
      options.pixelRatio,
      options.compact ? config.compactPixelRatio : config.maxPixelRatio,
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NeutralToneMapping;

    this.camera = new PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
    // At this distance the focal plane (z = 0) is exactly two units tall.
    this.camera.position.z = 1 / Math.tan(MathUtils.degToRad(camera.fov) / 2);

    const pieces: DecorPiece[] = [];
    if (composition.ribbons) {
      this.ribbons = new LightRibbons(options.compact, look);
      this.ribbons.object.position.y = composition.ribbonsY;
      pieces.push(this.ribbons);
    }
    if (composition.array) {
      // Only the panels reflect anything, so only they pay for an environment.
      const pmrem = new PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.environment = pmrem.fromScene(room, ENVIRONMENT_BLUR).texture;
      room.dispose();
      pmrem.dispose();
      this.scene.environment = this.environment;
      this.array = new SolarArray(look);
      pieces.push(this.array);
    }
    const count = Math.round(
      (options.compact ? motes.compactCount : motes.count) * composition.motes,
    );
    this.motes = new AmbientMotes(count, pixelRatio, look);
    pieces.push(this.motes);
    this.pieces = pieces;

    this.keyLight.position.set(2.5, 3, 4);
    this.scene.add(this.keyLight, this.fillLight);
    this.field.add(this.motes.object);
    if (this.ribbons) this.field.add(this.ribbons.object);
    this.root.add(this.field);
    if (this.array) this.root.add(this.array.object);
    this.scene.add(this.root);
    this.applyLook(look);

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
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.layout();
  }

  setTheme(theme: DecorTheme): void {
    const look = DECOR.looks[theme];
    for (const piece of this.pieces) piece.setLook(look);
    this.applyLook(look);
  }

  setDirection(rtl: boolean): void {
    this.rtl = rtl;
    this.layout();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.pointer.set(0, 0);
    this.needsRender = true;
  }

  /** Pointer position over the page, each axis in [-1, 1] — drives a gentle parallax. */
  setPointer(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.pointer.set(MathUtils.clamp(x, -1, 1), MathUtils.clamp(y, -1, 1));
  }

  dispose(): void {
    this.stop();
    this.timer.dispose();
    disposeRenderer(this.renderer, this.scene, () => {
      for (const piece of this.pieces) piece.dispose();
      this.scene.environment = null;
      this.environment?.dispose();
    });
  }

  private applyLook(look: DecorLook): void {
    this.renderer.toneMappingExposure = look.exposure;
    this.scene.environmentIntensity = look.environment;
    this.keyLight.color.set(look.key.color);
    this.keyLight.intensity = look.key.intensity;
    this.fillLight.color.set(look.hemisphere.sky);
    this.fillLight.groundColor.set(look.hemisphere.ground);
    this.fillLight.intensity = look.hemisphere.intensity;
    this.needsRender = true;
  }

  /**
   * Places the pieces for the canvas shape, the alignment and the text
   * direction, then aims the camera. A wide banner gives a perspective
   * camera a very wide horizontal view, which would stretch an object near
   * its edge; so the camera looks straight at the solar array and the canvas
   * is cut from an off-centre frame around it (a view offset), keeping the
   * array undistorted wherever it sits. In right-to-left layouts the array
   * is mirrored, so its sun stays towards the outer edge.
   */
  private layout(): void {
    const { ribbons: ribbonConfig, array: config, compactWidth } = DECOR;
    // The view is two units tall, so its half-width is the aspect ratio.
    const halfWidth = this.width / this.height;
    const { ribbonScale } = DECOR.compositions[this.options.composition];
    if (this.ribbons) {
      this.ribbons.setLength((2 * (halfWidth + ribbonConfig.overscan)) / ribbonScale);
      // Mirrored for right-to-left, so the gold end stays by the array.
      this.ribbons.object.scale.set((this.rtl ? -1 : 1) * ribbonScale, ribbonScale, ribbonScale);
    }
    this.motes.setAspect(halfWidth);

    if (this.array) {
      const end = this.rtl ? -1 : 1;
      const [extentX, extentY] = config.extent;
      const { object } = this.array;
      let scale: number;
      if (this.options.align === 'center') {
        scale = Math.min(config.fill / extentY, (halfWidth * 0.9) / extentX);
        object.position.set(0, 0, 0);
      } else if (this.width < compactWidth) {
        scale = config.compact.fill / extentY;
        object.position.set(end * (halfWidth - config.compact.x), config.compact.y, 0);
      } else {
        scale = Math.min(config.fill / extentY, (halfWidth * 0.5) / extentX);
        object.position.set(end * (halfWidth - config.endInset - extentX * scale), 0, 0);
      }
      object.scale.set((this.options.align === 'end' ? end : 1) * scale, scale, scale);
    }

    const axis = this.array?.object.position.x ?? 0;
    const axisPixels = ((axis + halfWidth) * this.height) / 2;
    const fullWidth = 2 * Math.max(axisPixels, this.width - axisPixels);
    this.camera.position.x = axis;
    this.camera.aspect = fullWidth / this.height;
    this.camera.setViewOffset(
      fullWidth,
      this.height,
      fullWidth / 2 - axisPixels,
      0,
      this.width,
      this.height,
    );
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private readonly tick = (timestamp: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (timestamp - this.lastFrameTime < DECOR.renderer.minFrameInterval) return;
    this.lastFrameTime = timestamp;

    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), DECOR.renderer.maxFrameDelta);
    const moved = this.updateParallax(delta);
    // Under reduced motion nothing changes on its own: skip idle frames.
    if (this.reducedMotion && !moved && !this.needsRender) return;
    this.needsRender = false;

    if (!this.reducedMotion) {
      this.elapsed += delta;
      this.shown += delta;
    }
    for (const piece of this.pieces) piece.update(this.elapsed);
    this.updateEntrance();
    this.renderer.render(this.scene, this.camera);
    if (!this.rendered) {
      this.rendered = true;
      this.options.onFirstFrame();
    }
  };

  /**
   * Eases towards the pointer: the field tilts a touch, the array leans
   * round its own centre a little more. True while it is still moving.
   */
  private updateParallax(delta: number): boolean {
    const { parallaxYaw, parallaxPitch, parallaxRate, lean } = DECOR.motion;
    const previous = this.parallax.x + this.parallax.y;
    this.parallax.lerp(this.pointer, 1 - Math.exp(-parallaxRate * delta));
    this.field.rotation.set(-this.parallax.y * parallaxPitch, this.parallax.x * parallaxYaw, 0);
    this.array?.object.rotation.set(-this.parallax.y * lean.pitch, this.parallax.x * lean.yaw, 0);
    return Math.abs(this.parallax.x + this.parallax.y - previous) > SETTLED;
  }

  /** On first show the piece settles up into place as the canvas fades in. */
  private updateEntrance(): void {
    const progress = this.reducedMotion ? 1 : Math.min(1, this.shown / DECOR.motion.entrance);
    this.root.position.y = (1 - MathUtils.smootherstep(progress, 0, 1)) * -0.06;
  }
}
