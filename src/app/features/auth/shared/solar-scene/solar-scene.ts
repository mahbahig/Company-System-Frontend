import {
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Spherical,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { disposeRenderer } from '../../../../shared/decor/dispose-renderer';
import { EnergyOrbits } from './energy-orbits';
import type { SceneFraming } from './scene-framing.interface';
import type { SceneLook } from './scene-look.type';
import type { SceneTheme } from './scene-theme.type';
import { SolarDust } from './solar-dust';
import type { SolarSceneOptions } from './solar-scene-options.interface';
import { SOLAR_SCENE } from './solar-scene.config';
import { Sun } from './sun';
import { SunGrip } from './sun-grip';
import { Wordmark } from './wordmark';

/** Below this summed angle/zoom error the camera counts as back at rest. */
const SETTLED = 0.0005;
/** Blur of the studio environment the metal reflects. */
const ENVIRONMENT_BLUR = 0.04;

const offset = new Vector3();
const spherical = new Spherical();

/**
 * The interactive solar scene behind the sign-in screens — framework-free, so
 * the Angular wrapper only handles lifecycle and DOM events.
 *
 * - The camera is fitted to the sun + wordmark lockup for any canvas size and
 *   framing; OrbitControls (damped, no pan) rotate and zoom within limits that
 *   keep the wordmark legible.
 * - The sun itself can be grabbed and turned all the way round ({@link SunGrip});
 *   it stops spinning while held and springs home when let go.
 * - On first show the camera eases in from a wider pose; after a few idle
 *   seconds it drifts back to rest, so the composition always recovers.
 * - Reduced motion freezes all ambient animation and renders only when the
 *   user moves the camera or the sun.
 * - `setTheme()` relights it for the app theme (daylight or night) in place.
 * - `dispose()` releases every GPU resource and the WebGL context itself.
 */
export class SolarScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly environment: Texture;
  private readonly keyLight = new DirectionalLight();
  private readonly rimLight = new DirectionalLight();
  private readonly fillLight = new HemisphereLight();
  private readonly rig = new Group();
  private readonly sun: Sun;
  private readonly wordmark: Wordmark;
  private readonly dust: SolarDust;
  private readonly orbits: EnergyOrbits;
  private readonly grip: SunGrip;
  private readonly timer = new Timer();
  private readonly target = new Vector3(...SOLAR_SCENE.composition.target);
  private readonly home = new Spherical(1, Math.PI / 2 - SOLAR_SCENE.camera.homeElevation, 0);
  private readonly parallax = new Vector2();

  private framing: SceneFraming;
  private reducedMotion: boolean;
  private width = 1;
  private height = 1;
  private fitDistance = 0;
  /** Ambient-animation clock; frozen under reduced motion. */
  private elapsed: number = SOLAR_SCENE.motion.restTime;
  /** The sun's turning clock: the ambient clock, minus the time it was held. */
  private turning: number = SOLAR_SCENE.motion.restTime;
  /** Wall clock, for idle detection. */
  private clock = 0;
  private lastFrameTime = 0;
  private lastInteraction = Number.NEGATIVE_INFINITY;
  private interacting = false;
  private interacted = false;
  private introducing: boolean;
  private needsRender = true;
  private rendered = false;
  private frame = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly options: SolarSceneOptions,
  ) {
    const { renderer: config, camera: cameraConfig, lighting } = SOLAR_SCENE;
    const look = SOLAR_SCENE.looks[options.theme];
    this.framing = options.framing;
    this.reducedMotion = options.reducedMotion;
    this.introducing = !options.reducedMotion;

    // Transparent canvas: the layout's CSS backdrop shows through, so the page
    // looks finished before (or without) WebGL.
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'default',
    });
    this.renderer.debug.checkShaderErrors = options.checkShaders;
    const pixelRatio = Math.min(options.pixelRatio, config.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NeutralToneMapping;

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, ENVIRONMENT_BLUR).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment;

    this.camera = new PerspectiveCamera(cameraConfig.fov, 1, cameraConfig.near, cameraConfig.far);

    this.rimLight.position.set(...lighting.rimPosition);
    this.scene.add(this.keyLight, this.rimLight, this.fillLight);

    this.sun = new Sun(look);
    this.wordmark = new Wordmark(look);
    this.dust = new SolarDust(pixelRatio, look);
    this.orbits = new EnergyOrbits(pixelRatio, look);
    this.applyLook(look);
    this.rig.add(this.sun.object, this.orbits.object, this.wordmark.object, this.dust.object);
    this.scene.add(this.rig);

    this.controls = this.createControls();
    // The grip listens first, so a press on the sun never also orbits the camera.
    this.grip = new SunGrip(
      canvas,
      this.camera,
      this.controls,
      this.sun,
      options.reducedMotion,
      this.noteInteraction,
    );
    this.controls.connect(canvas);
    // OrbitControls claims every touch gesture; on touch screens hand vertical
    // swipes back to the page so the form below can always be scrolled to.
    if (options.touchScroll) canvas.style.touchAction = 'pan-y';
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
    this.applyFraming();
  }

  setFraming(framing: SceneFraming): void {
    this.framing = framing;
    this.applyFraming();
  }

  setTheme(theme: SceneTheme): void {
    const look = SOLAR_SCENE.looks[theme];
    this.sun.setLook(look);
    this.wordmark.setLook(look);
    this.dust.setLook(look);
    this.orbits.setLook(look);
    this.applyLook(look);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.grip.setReducedMotion(reduced);
    if (reduced) {
      this.introducing = false;
      this.parallax.set(0, 0);
    }
    this.needsRender = true;
  }

  /** Pointer position over the page, each axis in [-1, 1] — drives a gentle parallax. */
  setPointer(x: number, y: number): void {
    if (this.reducedMotion) return;
    this.parallax.set(MathUtils.clamp(x, -1, 1), MathUtils.clamp(y, -1, 1));
  }

  dispose(): void {
    this.stop();
    this.controls.removeEventListener('start', this.onControlStart);
    this.controls.removeEventListener('end', this.onControlEnd);
    this.grip.dispose();
    this.controls.dispose();
    this.timer.dispose();
    disposeRenderer(this.renderer, this.scene, () => {
      this.sun.dispose();
      this.wordmark.dispose();
      this.dust.dispose();
      this.orbits.dispose();
      this.environment.dispose();
    });
  }

  /** The scene-wide part of a look: exposure, environment and the lights. */
  private applyLook(look: SceneLook): void {
    this.renderer.toneMappingExposure = look.exposure;
    this.scene.environmentIntensity = look.environment;
    this.keyLight.color.set(look.key.color);
    this.keyLight.intensity = look.key.intensity;
    this.rimLight.color.set(look.rim.color);
    this.rimLight.intensity = look.rim.intensity;
    this.fillLight.color.set(look.hemisphere.sky);
    this.fillLight.groundColor.set(look.hemisphere.ground);
    this.fillLight.intensity = look.hemisphere.intensity;
    this.needsRender = true;
  }

  /** Created unconnected; the constructor connects them to the canvas after the sun grip. */
  private createControls(): OrbitControls {
    const { controls: config } = SOLAR_SCENE;
    const controls = new OrbitControls(this.camera);
    controls.target.copy(this.target);
    controls.enableDamping = true;
    controls.dampingFactor = config.dampingFactor;
    controls.enablePan = false;
    controls.rotateSpeed = config.rotateSpeed;
    controls.zoomSpeed = config.zoomSpeed;
    controls.minAzimuthAngle = -config.azimuthRange;
    controls.maxAzimuthAngle = config.azimuthRange;
    controls.minPolarAngle = Math.PI / 2 - config.polarRise;
    controls.maxPolarAngle = Math.PI / 2 + config.polarDip;
    controls.addEventListener('start', this.onControlStart);
    controls.addEventListener('end', this.onControlEnd);
    return controls;
  }

  private readonly onControlStart = (): void => {
    this.interacting = true;
    this.introducing = false;
    this.noteInteraction();
  };

  private readonly noteInteraction = (): void => {
    if (this.interacted) return;
    this.interacted = true;
    this.options.onFirstInteraction();
  };

  private readonly onControlEnd = (): void => {
    this.interacting = false;
    this.lastInteraction = this.clock;
  };

  /**
   * Fits the lockup into the framed region. The projection centre is shifted
   * with a view offset (not by moving the camera), so orbiting still pivots on
   * the lockup while it sits where the layout wants it.
   */
  private applyFraming(): void {
    const { width, height, camera } = this;
    const { centerY, fillWidth, fillHeight } = this.framing;
    const { composition, controls: limits, motion } = SOLAR_SCENE;

    const shift = height * (0.5 - centerY);
    const fullHeight = height + 2 * Math.abs(shift);
    camera.aspect = width / fullHeight;
    camera.setViewOffset(width, fullHeight, 0, Math.max(0, 2 * shift), width, height);
    camera.updateProjectionMatrix();

    // Pixels per world unit at distance 1, then the distance at which the
    // lockup fills exactly its allowed share of the canvas.
    const pixelsPerUnit = fullHeight / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
    const fit = Math.max(
      (composition.width * pixelsPerUnit) / (fillWidth * width),
      (composition.height * pixelsPerUnit) / (fillHeight * height),
    );

    const firstFit = this.fitDistance === 0;
    const zoom = firstFit ? 1 : camera.position.distanceTo(this.target) / this.fitDistance;
    this.fitDistance = fit;
    this.home.radius = fit;
    this.controls.minDistance = fit * limits.minZoom;
    this.controls.maxDistance = fit * limits.maxZoom;

    if (firstFit) {
      const pose = this.introducing
        ? new Spherical(fit * motion.introZoom, this.home.phi, motion.introAzimuth)
        : this.home;
      this.camera.position.copy(this.target).add(offset.setFromSpherical(pose));
    } else {
      // Keep the user's relative zoom across resizes.
      offset
        .copy(camera.position)
        .sub(this.target)
        .setLength(fit * MathUtils.clamp(zoom, limits.minZoom, limits.maxZoom));
      camera.position.copy(this.target).add(offset);
    }
    this.camera.lookAt(this.target);
    this.needsRender = true;
  }

  private readonly tick = (timestamp: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    if (timestamp - this.lastFrameTime < SOLAR_SCENE.renderer.minFrameInterval) return;
    this.lastFrameTime = timestamp;

    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), SOLAR_SCENE.renderer.maxFrameDelta);
    this.clock += delta;
    if (!this.reducedMotion) {
      this.elapsed += delta;
      if (!this.grip.held) this.turning += delta;
    }

    const cameraMoved = this.updateCamera(delta);
    const sunMoved = this.grip.update(delta);
    // Under reduced motion nothing changes on its own: skip idle frames.
    if (this.reducedMotion && !cameraMoved && !sunMoved && !this.needsRender) return;
    this.needsRender = false;

    this.updateScene(delta);
    this.renderer.render(this.scene, this.camera);
    if (!this.rendered) {
      this.rendered = true;
      this.options.onFirstFrame();
    }
  };

  /** Intro / return-to-rest easing, then the damped controls. True when the camera moved. */
  private updateCamera(delta: number): boolean {
    const { motion } = SOLAR_SCENE;
    const idle = !this.interacting && this.clock - this.lastInteraction > motion.idleReturnDelay;
    let eased = false;

    if (this.introducing || (idle && !this.reducedMotion)) {
      offset.copy(this.camera.position).sub(this.target);
      spherical.setFromVector3(offset);
      const theta = this.home.theta - spherical.theta;
      const phi = this.home.phi - spherical.phi;
      const radius = this.home.radius - spherical.radius;

      if (Math.abs(theta) + Math.abs(phi) + Math.abs(radius) / this.fitDistance > SETTLED) {
        const ease =
          1 - Math.exp(-(this.introducing ? motion.introRate : motion.returnRate) * delta);
        spherical.theta += theta * ease;
        spherical.phi += phi * ease;
        spherical.radius += radius * ease;
        this.camera.position.copy(this.target).add(offset.setFromSpherical(spherical));
        eased = true;
      } else {
        this.introducing = false;
      }
    }

    return this.controls.update(delta) || eased;
  }

  private updateScene(delta: number): void {
    const { lighting, motion } = SOLAR_SCENE;
    const { elapsed } = this;

    this.sun.update(elapsed, this.turning, this.grip.turn, this.camera);
    this.wordmark.update(elapsed, this.reducedMotion ? Number.POSITIVE_INFINITY : this.clock);
    this.dust.update(elapsed);
    this.orbits.update(elapsed);

    // The key light sweeps slowly across the front, so a soft highlight glides
    // over the metal letters.
    const { key } = lighting;
    this.keyLight.position.set(
      Math.sin(elapsed * key.sweepSpeed) * key.sweepRadius,
      key.height,
      key.depth,
    );

    const follow = 1 - Math.exp(-motion.parallaxRate * delta);
    this.rig.rotation.y += (this.parallax.x * motion.parallaxYaw - this.rig.rotation.y) * follow;
    this.rig.rotation.x += (this.parallax.y * motion.parallaxPitch - this.rig.rotation.x) * follow;
  }
}
