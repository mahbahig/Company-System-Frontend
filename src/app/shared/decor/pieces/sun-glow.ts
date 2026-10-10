import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

import { DECOR } from '../decor.config';
import type { DecorLook } from '../decor-look.type';
import type { DecorPiece } from '../decor-piece.interface';
import { SUN_GLOW_FRAGMENT, SUN_GLOW_VERTEX } from '../shaders/sun-glow.glsl';

/** The warm glow of the sun the panels face, breathing very slowly. */
export class SunGlow implements DecorPiece {
  readonly object: Mesh<PlaneGeometry, ShaderMaterial>;

  private readonly uniforms = {
    uColor: { value: new Color() },
    uOpacity: { value: 0 },
  };
  private opacity = 0;

  constructor(look: DecorLook) {
    const { position, size } = DECOR.array.glow;
    this.object = new Mesh(
      new PlaneGeometry(size, size),
      new ShaderMaterial({
        vertexShader: SUN_GLOW_VERTEX,
        fragmentShader: SUN_GLOW_FRAGMENT,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.object.position.set(...position);
    this.setLook(look);
  }

  setLook(look: DecorLook): void {
    this.object.material.blending = look.blending;
    this.uniforms.uColor.value.set(look.glow.color);
    this.opacity = look.glow.opacity;
  }

  update(time: number): void {
    const { breathSpeed, breathAmount } = DECOR.array.glow;
    this.uniforms.uOpacity.value = this.opacity * (1 + Math.sin(time * breathSpeed) * breathAmount);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
