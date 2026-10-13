import {
  BoxGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';

import { DECOR } from '../decor.config';
import type { DecorLook } from '../decor-look.type';
import type { DecorPiece } from '../decor-piece.interface';
import {
  PANEL_COLOR_FRAGMENT,
  PANEL_FINISH_FRAGMENT,
  PANEL_FRAGMENT_PARS,
  PANEL_SWEEP_FRAGMENT,
  PANEL_VERTEX,
  PANEL_VERTEX_PARS,
} from '../shaders/photovoltaic.glsl';
import { SunGlow } from './sun-glow';

/** Where the band of sunlight waits between passes: far off the panels. */
const SWEEP_PARKED = 1e4;
/** How far past the row the band starts and ends, in the piece's own units. */
const SWEEP_MARGIN = 0.6;

/**
 * Three all-black photovoltaic panels floating in a staggered row, facing a
 * warm sun: dark glass over monocrystalline cells (drawn in the shader, no
 * textures), fine champagne-metal frames. The row slowly turns as if following the sun, each
 * panel's tilt answering a beat behind its neighbour, and now and then a band
 * of sunlight runs across the glass. `object` is placed and scaled by the
 * stage; everything moves inside it.
 */
export class SolarArray implements DecorPiece {
  readonly object = new Group();

  private readonly row = new Group();
  private readonly geometry: BoxGeometry;
  private readonly glass = new MeshPhysicalMaterial();
  private readonly frame = new MeshStandardMaterial();
  private readonly panels: Mesh<BoxGeometry, (MeshPhysicalMaterial | MeshStandardMaterial)[]>[] =
    [];
  private readonly glow: SunGlow;
  private readonly uniforms = {
    uCells: { value: new Vector2(...DECOR.array.cells) },
    uFrame: { value: new Vector2() },
    uBorder: { value: new Vector2() },
    uCellColor: { value: new Color() },
    uBusbarColor: { value: new Color() },
    uBacksheetColor: { value: new Color() },
    uFrameColor: { value: new Color() },
    uFrameMetalness: { value: 0 },
    uFrameRoughness: { value: 0 },
    uSkyColor: { value: new Color() },
    uSkyStrength: { value: 0 },
    uSweep: { value: SWEEP_PARKED },
    uSweepOrigin: { value: new Vector3() },
    uSweepColor: { value: new Color() },
    uSweepStrength: { value: 0 },
    uSweepWidth: { value: 1 },
    uSweepSlope: { value: DECOR.array.sweep.slope },
  };
  private readonly worldScale = new Vector3();

  constructor(look: DecorLook) {
    const { panel, frame, border, panels } = DECOR.array;
    this.uniforms.uFrame.value.set(frame / panel.width, frame / panel.height);
    this.uniforms.uBorder.value.set(border / panel.width, border / panel.height);

    this.geometry = new BoxGeometry(panel.width, panel.height, panel.depth);
    // BoxGeometry's faces, in order: ±x, ±y, front (+z), back (−z).
    const faces = [this.frame, this.frame, this.frame, this.frame, this.glass, this.frame];
    for (const { position } of panels) {
      const mesh = new Mesh(this.geometry, faces);
      mesh.position.fromArray(position);
      this.panels.push(mesh);
    }
    this.row.add(...this.panels);
    this.glow = new SunGlow(look);
    this.object.add(this.glow.object, this.row);

    this.glass.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${PANEL_VERTEX_PARS}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${PANEL_VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PANEL_FRAGMENT_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${PANEL_COLOR_FRAGMENT}`)
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>\n${PANEL_FINISH_FRAGMENT}`,
        )
        .replace(
          '#include <opaque_fragment>',
          `${PANEL_SWEEP_FRAGMENT}\n#include <opaque_fragment>`,
        );
    };
    this.glass.customProgramCacheKey = () => 'decor-photovoltaic';
    this.setLook(look);
  }

  setLook(look: DecorLook): void {
    const { glass, cells, frame, sky, sweep } = look;
    this.glass.setValues(glass);
    this.frame.setValues(frame);
    this.uniforms.uCellColor.value.set(cells.cell);
    this.uniforms.uBusbarColor.value.set(cells.busbar);
    this.uniforms.uBacksheetColor.value.set(cells.backsheet);
    this.uniforms.uFrameColor.value.set(frame.color);
    this.uniforms.uFrameMetalness.value = frame.metalness;
    this.uniforms.uFrameRoughness.value = frame.roughness;
    this.uniforms.uSkyColor.value.set(sky.color);
    this.uniforms.uSkyStrength.value = sky.strength;
    this.uniforms.uSweepColor.value.set(sweep.color);
    this.uniforms.uSweepStrength.value = sweep.strength;
    this.glow.setLook(look);
  }

  update(time: number): void {
    const { track, float, panels } = DECOR.array;
    this.row.rotation.y = Math.sin(time * track.yawSpeed) * track.yaw;
    this.row.position.y = Math.sin(time * float.speed) * float.amplitude;
    panels.forEach((panel, index) => {
      const mesh = this.panels[index];
      const tilt = panel.tilt + Math.sin(time * track.tiltSpeed - panel.phase) * track.tilt;
      // Lean back towards the sky first, then turn towards the sun.
      mesh.rotation.set(-tilt, panel.turn, 0, 'YXZ');
      mesh.position.y =
        panel.position[1] +
        Math.sin(time * float.speed * 1.3 + panel.phase) * float.amplitude * 0.5;
    });
    this.glow.update(time);
    this.updateSweep(time);
  }

  dispose(): void {
    this.geometry.dispose();
    this.glass.dispose();
    this.frame.dispose();
    this.glow.dispose();
  }

  /** Moves the band of sunlight; it works in world space, so it follows the piece's placement and scale. */
  private updateSweep(time: number): void {
    const { sweep, extent } = DECOR.array;
    const pass = time >= sweep.delay ? ((time - sweep.delay) % sweep.period) / sweep.duration : -1;
    this.object.updateWorldMatrix(true, false);
    this.object.getWorldPosition(this.uniforms.uSweepOrigin.value);
    const scale = Math.abs(this.object.getWorldScale(this.worldScale).y);
    const span = (extent[0] + SWEEP_MARGIN) * scale;
    this.uniforms.uSweepWidth.value = sweep.width * scale;
    this.uniforms.uSweep.value =
      pass >= 0 && pass < 1
        ? MathUtils.lerp(-span, span, MathUtils.smootherstep(pass, 0, 1))
        : SWEEP_PARKED;
  }
}
