import { BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial } from 'three';

import type { SceneLook } from './scene-look.type';
import { DUST_FRAGMENT, DUST_VERTEX } from './shaders/light-points.glsl';
import { SOLAR_SCENE } from './solar-scene.config';

/**
 * A sparse field of drifting "photons" around the lockup — mostly warm, a few
 * petrol — that gives the space depth when the scene is turned. Seeded, so
 * the field is identical on every visit; all motion happens in the shader.
 */
export class SolarDust {
  readonly object: Points<BufferGeometry, ShaderMaterial>;

  private readonly uniforms = {
    uTime: { value: 0 },
    uSize: { value: SOLAR_SCENE.dust.size },
    uPixelRatio: { value: 1 },
    uOpacity: { value: 0 },
    uWarm: { value: new Color() },
    uCool: { value: new Color() },
  };

  constructor(pixelRatio: number, look: SceneLook) {
    const { count, innerRadius, outerRadius, height, seed } = SOLAR_SCENE.dust;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const warmth = new Float32Array(count);
    MathUtils.seededRandom(seed);
    for (let index = 0; index < count; index++) {
      const radius = MathUtils.lerp(innerRadius, outerRadius, Math.sqrt(MathUtils.seededRandom()));
      const angle = MathUtils.seededRandom() * Math.PI * 2;
      // Flattened towards the camera so no mote drifts right up to the lens.
      positions.set(
        [
          Math.cos(angle) * radius,
          (MathUtils.seededRandom() - 0.5) * height * 2,
          Math.sin(angle) * radius * 0.7,
        ],
        index * 3,
      );
      seeds[index] = MathUtils.seededRandom();
      warmth[index] = MathUtils.seededRandom() < 0.72 ? 1 : 0;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geometry.setAttribute('aWarmth', new BufferAttribute(warmth, 1));

    this.object = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.object.position.set(...SOLAR_SCENE.composition.target);
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.setLook(look);
  }

  setLook(look: SceneLook): void {
    this.object.material.blending = look.blending;
    this.uniforms.uWarm.value.set(look.dust.warm);
    this.uniforms.uCool.value.set(look.dust.cool);
    this.uniforms.uOpacity.value = look.dust.opacity;
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
