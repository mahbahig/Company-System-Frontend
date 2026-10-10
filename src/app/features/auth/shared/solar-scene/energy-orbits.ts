import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Points,
  ShaderMaterial,
} from 'three';

import type { SceneLook } from './scene-look.type';
import { GLINT_FRAGMENT, GLINT_VERTEX } from './shaders/light-points.glsl';
import { SOLAR_SCENE } from './solar-scene.config';

const ORBIT_SEGMENTS = 256;
/** The whole path stays faintly visible; the arc behind the glint glows brighter. */
const PATH_ALPHA = 0.08;
const GLINT_SIZE = 150;

/**
 * Two hairline orbits around the sun, each carrying a glint of light with a
 * fading wake — a quiet nod to energy flowing through a managed network.
 */
export class EnergyOrbits {
  readonly object = new Group();

  private readonly spinners: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  /** Vertex colours carry only the wake's alpha; the material supplies the hue. */
  private readonly lineMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  private readonly glintUniforms = {
    uSize: { value: GLINT_SIZE },
    uPixelRatio: { value: 1 },
    uColor: { value: new Color() },
    uCore: { value: new Color() },
    uOpacity: { value: 0.9 },
  };
  private readonly glintMaterial = new ShaderMaterial({
    vertexShader: GLINT_VERTEX,
    fragmentShader: GLINT_FRAGMENT,
    uniforms: this.glintUniforms,
    transparent: true,
    depthWrite: false,
  });

  constructor(pixelRatio: number, look: SceneLook) {
    const { orbits, sun } = SOLAR_SCENE;
    this.glintUniforms.uPixelRatio.value = pixelRatio;

    for (const orbit of orbits) {
      const path = orbitPath(orbit.radius, Math.sign(orbit.speed), orbit.opacity);
      const glint = new BufferGeometry();
      glint.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([orbit.radius, 0, 0]), 3),
      );
      this.geometries.push(path, glint);

      const spinner = new Group();
      spinner.rotation.z = orbit.phase;
      spinner.add(new Line(path, this.lineMaterial), new Points(glint, this.glintMaterial));
      this.spinners.push(spinner);

      const plane = new Group();
      plane.rotation.set(orbit.tilt, 0, orbit.roll);
      plane.add(spinner);
      this.object.add(plane);
    }
    this.object.position.set(...sun.position);
    this.setLook(look);
  }

  setLook(look: SceneLook): void {
    this.lineMaterial.blending = look.blending;
    this.lineMaterial.color.set(look.orbits.line);
    this.glintMaterial.blending = look.blending;
    this.glintUniforms.uColor.value.set(look.orbits.glint);
    this.glintUniforms.uCore.value.set(look.orbits.glintCore);
  }

  update(elapsed: number): void {
    SOLAR_SCENE.orbits.forEach((orbit, index) => {
      this.spinners[index].rotation.z = orbit.phase + elapsed * orbit.speed;
    });
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.lineMaterial.dispose();
    this.glintMaterial.dispose();
  }
}

/**
 * A closed circle whose per-vertex alpha fades from the glint (at angle 0)
 * back along the direction it came from, over a faint full-circle base.
 */
function orbitPath(radius: number, direction: number, opacity: number): BufferGeometry {
  const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
  const colors = new Float32Array((ORBIT_SEGMENTS + 1) * 4);
  for (let index = 0; index <= ORBIT_SEGMENTS; index++) {
    const progress = index / ORBIT_SEGMENTS;
    const angle = -direction * progress * Math.PI * 2;
    const wake = Math.pow(1 - progress, 3);
    positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], index * 3);
    colors.set([1, 1, 1, (PATH_ALPHA + wake * (1 - PATH_ALPHA)) * opacity], index * 4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 4));
  return geometry;
}
