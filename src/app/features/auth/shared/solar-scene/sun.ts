import {
  Color,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  type Camera,
  type Sphere,
} from 'three';

import type { SceneLook } from './scene-look.type';
import { SUN_CORONA_FRAGMENT, SUN_CORONA_VERTEX } from './shaders/sun-corona.glsl';
import { SUN_SURFACE_FRAGMENT, SUN_SURFACE_VERTEX } from './shaders/sun-surface.glsl';
import { SOLAR_SCENE } from './solar-scene.config';

const parentRotation = new Quaternion();

/**
 * The sun: a plasma-shaded sphere that turns, a camera-facing corona behind
 * it carrying the turning crown of rays, and a warm point light that rims the
 * wordmark's upper edges. The sphere sits in its own `body` group, so the
 * user can turn it (see `SunGrip`) without disturbing the corona or light.
 */
export class Sun {
  readonly object = new Group();
  private readonly body = new Group();

  private readonly time = { value: 0 };
  private readonly coronaUniforms = {
    uTime: this.time,
    uExtent: { value: SOLAR_SCENE.sun.coronaExtent },
    uRays: { value: SOLAR_SCENE.sun.rays },
    uTurn: { value: 0 },
    uInner: { value: new Color() },
    uOuter: { value: new Color() },
    uRayColor: { value: new Color() },
    uGlow: { value: 0 },
    uHaze: { value: 0 },
    uRayStrength: { value: 0 },
    uPulse: { value: 0 },
  };
  private readonly surface: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly corona: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly light: PointLight;
  private lightIntensity = 0;

  constructor(look: SceneLook) {
    const { position, radius, coronaExtent, segments } = SOLAR_SCENE.sun;
    const { palette } = SOLAR_SCENE;
    this.object.position.set(...position);

    this.surface = new Mesh(
      new SphereGeometry(radius, segments.width, segments.height),
      new ShaderMaterial({
        vertexShader: SUN_SURFACE_VERTEX,
        fragmentShader: SUN_SURFACE_FRAGMENT,
        uniforms: {
          uTime: this.time,
          uHot: { value: new Color(palette.sunHot) },
          uMid: { value: new Color(palette.sun) },
          uDeep: { value: new Color(palette.sunDeep) },
          uEmber: { value: new Color(palette.sunEmber) },
        },
      }),
    );

    // Depth-tested but not depth-writing: the disc hides the corona's centre,
    // while the corona never hides anything itself.
    this.corona = new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        vertexShader: SUN_CORONA_VERTEX,
        fragmentShader: SUN_CORONA_FRAGMENT,
        uniforms: this.coronaUniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.corona.scale.setScalar(radius * coronaExtent * 2);

    this.light = new PointLight(palette.sunLight, 0, 0, 2);
    this.body.add(this.surface);
    this.object.add(this.body, this.corona, this.light);
    this.setLook(look);
  }

  /** The disc in world space, breathing included — for hit tests. */
  getBounds(target: Sphere): Sphere {
    this.object.getWorldPosition(target.center);
    target.radius = SOLAR_SCENE.sun.radius * this.object.scale.x;
    return target;
  }

  setLook(look: SceneLook): void {
    const { corona } = look;
    const uniforms = this.coronaUniforms;
    this.corona.material.blending = look.blending;
    uniforms.uInner.value.set(corona.inner);
    uniforms.uOuter.value.set(corona.outer);
    uniforms.uRayColor.value.set(corona.rays);
    uniforms.uGlow.value = corona.glow;
    uniforms.uHaze.value = corona.haze;
    uniforms.uRayStrength.value = corona.rayStrength;
    uniforms.uPulse.value = corona.pulse;
    this.lightIntensity = look.sunLight;
  }

  /**
   * @param elapsed The ambient clock: plasma, breathing and the light's pulse.
   * @param turning The clock the surface and crown turn by; it stops while the sun is held.
   * @param turn How far the user has turned the sun from rest.
   */
  update(elapsed: number, turning: number, turn: Quaternion, camera: Camera): void {
    const { spin, crownTurn, breath, light } = SOLAR_SCENE.sun;
    this.time.value = elapsed;
    this.body.quaternion.copy(turn);
    this.surface.rotation.y = turning * spin;
    this.coronaUniforms.uTurn.value = turning * crownTurn;
    this.object.scale.setScalar(1 + Math.sin(elapsed * breath.speed) * breath.amplitude);
    this.light.intensity =
      this.lightIntensity * (1 + light.pulse * Math.sin(elapsed * light.pulseSpeed));

    // Billboard: face the camera regardless of how the parent rig is turned.
    this.object.getWorldQuaternion(parentRotation).invert();
    this.corona.quaternion.multiplyQuaternions(parentRotation, camera.quaternion);
  }

  dispose(): void {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this.corona.geometry.dispose();
    this.corona.material.dispose();
    this.light.dispose();
  }
}
