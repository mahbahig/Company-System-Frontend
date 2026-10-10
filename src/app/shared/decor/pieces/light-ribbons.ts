import { Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

import { DECOR } from '../decor.config';
import type { DecorLook } from '../decor-look.type';
import type { DecorPiece } from '../decor-piece.interface';
import { RIBBON_FRAGMENT, RIBBON_VERTEX } from '../shaders/ribbon.glsl';

/**
 * Silk ribbons of light flowing slowly across the canvas, petrol-teal
 * turning to gold along their length. They share one strip geometry; every
 * ripple and turn happens in the vertex shader, so the CPU only sets a clock.
 */
export class LightRibbons implements DecorPiece {
  readonly object = new Group();

  private readonly geometry: PlaneGeometry;
  private readonly bands: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  /** Uniforms every ribbon reads; each also has its own band settings and opacity. */
  private readonly shared = {
    uTime: { value: 0 },
    uLength: { value: 1 },
    uGlintPeriod: { value: DECOR.ribbons.glintPeriod },
    uFrom: { value: new Color() },
    uTo: { value: new Color() },
  };
  private readonly opacities: { value: number }[] = [];

  constructor(compact: boolean, look: DecorLook) {
    const { segments, compactSegments, compactCount, bands } = DECOR.ribbons;
    this.geometry = new PlaneGeometry(1, 1, compact ? compactSegments : segments, 1);
    for (const band of compact ? bands.slice(0, compactCount) : bands) {
      const opacity = { value: 0 };
      this.opacities.push(opacity);
      const mesh = new Mesh(
        this.geometry,
        new ShaderMaterial({
          vertexShader: RIBBON_VERTEX,
          fragmentShader: RIBBON_FRAGMENT,
          uniforms: {
            ...this.shared,
            uOpacity: opacity,
            uY: { value: band.y },
            uWidth: { value: band.width },
            uAmplitude: { value: band.amplitude },
            uWave: { value: band.wave },
            uSpeed: { value: band.speed },
            uTwist: { value: band.twist },
            uDepth: { value: band.depth },
            uPhase: { value: band.phase },
          },
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      // The shader stretches the strip far beyond the bounds three.js knows of.
      mesh.frustumCulled = false;
      this.bands.push(mesh);
    }
    this.object.add(...this.bands);
    this.setLook(look);
  }

  /** Length of every ribbon in world units — wide enough to run past both edges. */
  setLength(length: number): void {
    this.shared.uLength.value = length;
  }

  setLook(look: DecorLook): void {
    this.shared.uFrom.value.set(look.ribbons.from);
    this.shared.uTo.value.set(look.ribbons.to);
    DECOR.ribbons.bands.forEach((band, index) => {
      const mesh = this.bands[index];
      if (!mesh) return;
      mesh.material.blending = look.blending;
      this.opacities[index].value = look.ribbons.opacity * band.opacity;
    });
  }

  update(time: number): void {
    this.shared.uTime.value = time;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const band of this.bands) band.material.dispose();
  }
}
