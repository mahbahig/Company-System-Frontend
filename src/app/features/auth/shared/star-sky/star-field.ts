import { BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial } from 'three';

import { STAR_FRAGMENT, STAR_VERTEX } from './shaders/star-sky.glsl';
import type { StarSkyLook } from './star-sky-look.type';
import { STAR_SKY } from './star-sky.config';

/**
 * The still field of stars. Positions are seeded fractions of the viewport
 * stretched to its size, so the sky is the same on every visit, and only as
 * many stars are drawn as the viewport's area calls for, so a large screen is
 * no denser than a small one. Twinkling happens in the shader.
 */
export class StarField {
  readonly object: Points<BufferGeometry, ShaderMaterial>;

  private readonly uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uOpacity: { value: 0 },
    uSparkle: { value: 0 },
    uCool: { value: new Color() },
    uWarm: { value: new Color() },
  };

  constructor(pixelRatio: number, look: StarSkyLook) {
    const { max, seed, brightShare, size, brightSize, warmShare } = STAR_SKY.stars;

    const positions = new Float32Array(max * 3);
    const sizes = new Float32Array(max);
    const seeds = new Float32Array(max);
    const tints = new Float32Array(max);
    const bright = new Float32Array(max);
    MathUtils.seededRandom(seed);
    for (let index = 0; index < max; index++) {
      positions.set([MathUtils.seededRandom(), MathUtils.seededRandom(), 0], index * 3);
      const isBright = MathUtils.seededRandom() < brightShare;
      // Mostly faint pinpricks, a few larger.
      sizes[index] = isBright
        ? MathUtils.lerp(brightSize[0], brightSize[1], MathUtils.seededRandom())
        : MathUtils.lerp(size[0], size[1], Math.pow(MathUtils.seededRandom(), 2.5));
      seeds[index] = MathUtils.seededRandom();
      tints[index] = MathUtils.seededRandom() < warmShare ? 1 : 0;
      bright[index] = isBright ? 1 : 0;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geometry.setAttribute('aTint', new BufferAttribute(tints, 1));
    geometry.setAttribute('aBright', new BufferAttribute(bright, 1));

    this.object = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.setLook(look);
  }

  setSize(width: number, height: number): void {
    const { area, max } = STAR_SKY.stars;
    this.object.scale.set(width, height, 1);
    this.object.geometry.setDrawRange(0, Math.min(max, Math.round((width * height) / area)));
  }

  setLook(look: StarSkyLook): void {
    this.object.material.blending = look.blending;
    this.uniforms.uCool.value.set(look.stars.cool);
    this.uniforms.uWarm.value.set(look.stars.warm);
    this.uniforms.uOpacity.value = look.stars.opacity;
    this.uniforms.uSparkle.value = look.stars.sparkle;
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
