import { BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial } from 'three';

import { DECOR } from '../decor.config';
import type { DecorLook } from '../decor-look.type';
import type { DecorPiece } from '../decor-piece.interface';
import { MOTES_FRAGMENT, MOTES_VERTEX } from '../shaders/motes.glsl';

/**
 * A few dozen motes of warm light hanging at different depths, so the space
 * has air in it and pointer parallax has something to slide. Seeded, so the
 * field is the same on every visit; all motion happens in the shader.
 */
export class AmbientMotes implements DecorPiece {
  readonly object: Points<BufferGeometry, ShaderMaterial>;

  private readonly uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uSize: { value: DECOR.motes.size },
    uPixelRatio: { value: 1 },
    uWarm: { value: new Color() },
    uCool: { value: new Color() },
    uOpacity: { value: 0 },
  };

  constructor(count: number, pixelRatio: number, look: DecorLook) {
    const { seed, depth } = DECOR.motes;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    MathUtils.seededRandom(seed);
    for (let index = 0; index < count; index++) {
      positions.set(
        [
          MathUtils.seededRandom() * 2 - 1,
          MathUtils.seededRandom() * 2 - 1,
          MathUtils.lerp(depth[0], depth[1], MathUtils.seededRandom()),
        ],
        index * 3,
      );
      seeds[index] = MathUtils.seededRandom();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    this.object = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: MOTES_VERTEX,
        fragmentShader: MOTES_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    // Spread across the canvas width in the shader, beyond the stored bounds.
    this.object.frustumCulled = false;
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.setLook(look);
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setLook(look: DecorLook): void {
    this.object.material.blending = look.blending;
    this.uniforms.uWarm.value.set(look.motes.warm);
    this.uniforms.uCool.value.set(look.motes.cool);
    this.uniforms.uOpacity.value = look.motes.opacity;
  }

  update(time: number): void {
    this.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
