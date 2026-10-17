import {
  Color,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Vector2,
  Vector3,
} from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';

import type { SceneLook } from './scene-look.type';
import {
  CHAMFER_FRAGMENT,
  FACE_FRAGMENT,
  REFLECTION_FRAGMENT,
  SWEEP_FRAGMENT,
  WORDMARK_FRAGMENT_PARS,
  WORDMARK_VERTEX,
  WORDMARK_VERTEX_PARS,
} from './shaders/wordmark.glsl';
import { BRAND_WORDMARK_GLYPHS } from '../../../../shared/ui/brand-wordmark/brand-wordmark-glyphs';
import { BRAND_WORDMARK } from '../../../../shared/ui/brand-wordmark/brand-wordmark.config';
import { layoutBrandWordmark } from '../../../../shared/ui/brand-wordmark/layout-brand-wordmark';
import { SOLAR_SCENE } from './solar-scene.config';
import { WORDMARK_TYPEFACE } from './wordmark-typeface';

/** Where the light band waits between passes: far off the letters. */
const SWEEP_PARKED = 1e4;
/** How far past the outer letters the band starts and ends, so it enters and leaves unseen. */
const SWEEP_MARGIN = 0.8;
/** Slight overshoot as each letter stands up — it settles rather than stops. */
const REVEAL_OVERSHOOT = 1.15;

/**
 * The Ecotech logotype as real extruded type — the brand wordmark's letters
 * (Archivo Expanded) set exactly as the 2D logotype is — one mesh per letter
 * so the letters can stand up one after another when the scene opens and
 * carry a slow wave afterwards.
 *
 * - Faces: satin — deep petrol ink by day, champagne white by night.
 * - An inset chamfer in brushed champagne metal, which traces a hairline
 *   round every letter seen from the front; the walls behind it are a deep
 *   green-petrol.
 * - A soft band of light glides across the letters every few seconds.
 * - A faint mirrored copy below the floor line, fading with depth, stands the
 *   type on an implied polished floor.
 */
export class Wordmark {
  /** Sits on the floor line; the letters stand on it and reflect in it. */
  readonly object = new Group();

  private readonly letters = new Group();
  private readonly reflectedLetters = new Group();
  private readonly glyphs: Mesh[] = [];
  private readonly reflections: Mesh[] = [];
  private readonly geometries: ExtrudeGeometry[] = [];
  private readonly face = new MeshPhysicalMaterial();
  /** Walls and bevel; its own colour is the chamfer's, the walls get `uWall*`. */
  private readonly rim = new MeshPhysicalMaterial();
  private readonly reflectedFace = new MeshPhysicalMaterial({ transparent: true });
  private readonly reflectedRim = new MeshPhysicalMaterial({ transparent: true });
  private readonly uniforms = {
    uSweep: { value: SWEEP_PARKED },
    uSweepColor: { value: new Color() },
    uSweepStrength: { value: 0 },
    uSweepWidth: { value: SOLAR_SCENE.wordmark.sweep.width },
    uSweepSlope: { value: SOLAR_SCENE.wordmark.sweep.slope },
    uSweepOrigin: { value: new Vector3(...SOLAR_SCENE.wordmark.floor) },
    uReflection: { value: 0 },
    uReflectionFade: { value: SOLAR_SCENE.wordmark.reflectionFade },
    uWallColor: { value: new Color() },
    uWallMetalness: { value: 0 },
    uWallRoughness: { value: 0 },
    uFaceShade: { value: new Vector2() },
    uCapHeight: {
      value:
        (BRAND_WORDMARK_GLYPHS.capHeight / BRAND_WORDMARK_GLYPHS.unitsPerEm) *
        SOLAR_SCENE.wordmark.size,
    },
  };
  private readonly sweepSpan: number;

  constructor(look: SceneLook) {
    const { size, depth, bevel, curveSegments, floor } = SOLAR_SCENE.wordmark;
    const font = new Font(WORDMARK_TYPEFACE);
    const em = BRAND_WORDMARK_GLYPHS.unitsPerEm;
    const { letters, left, right } = layoutBrandWordmark(
      BRAND_WORDMARK.text,
      BRAND_WORDMARK.tracking.large,
    );
    const middle = (left + right) / 2;
    const extrude = {
      depth,
      curveSegments,
      bevelEnabled: true,
      bevelThickness: bevel.thickness,
      bevelSize: bevel.size,
      bevelOffset: -bevel.size,
      bevelSegments: bevel.segments,
    };

    // ExtrudeGeometry's groups: 0 = front/back faces, 1 = walls and bevels.
    for (const { char, glyph, x } of letters) {
      // Pivot each letter on the middle of its own baseline, so it stands up in
      // place; the word is centred on its ink, not its advances.
      const centre = (glyph.left + glyph.right) / 2 / em;
      const geometry = new ExtrudeGeometry(font.generateShapes(char, size), extrude);
      geometry.translate(-centre * size, 0, -depth / 2);
      const letter = new Mesh(geometry, [this.face, this.rim]);
      const reflection = new Mesh(geometry, [this.reflectedFace, this.reflectedRim]);
      letter.position.x = reflection.position.x = (x + centre - middle) * size;
      this.geometries.push(geometry);
      this.glyphs.push(letter);
      this.reflections.push(reflection);
    }
    this.sweepSpan = ((right - left) / 2) * size + SWEEP_MARGIN;

    // The mirror image: the same letters, flipped through the floor plane.
    const reflection = new Group();
    reflection.scale.y = -1;
    reflection.add(this.reflectedLetters);
    this.letters.add(...this.glyphs);
    this.reflectedLetters.add(...this.reflections);
    this.object.add(this.letters, reflection);
    this.object.position.set(...floor);

    this.decorate(this.face, 'face');
    this.decorate(this.rim, 'rim');
    this.decorate(this.reflectedFace, 'face', true);
    this.decorate(this.reflectedRim, 'rim', true);
    this.setLook(look);
  }

  setLook(look: SceneLook): void {
    const { face, faceShade, chamfer, wall, sweep, reflection } = look.wordmark;
    this.face.setValues(face);
    this.reflectedFace.setValues(face);
    this.rim.setValues(chamfer);
    this.reflectedRim.setValues(chamfer);
    this.uniforms.uFaceShade.value.fromArray(faceShade);
    this.uniforms.uWallColor.value.set(wall.color);
    this.uniforms.uWallMetalness.value = wall.metalness;
    this.uniforms.uWallRoughness.value = wall.roughness;
    this.uniforms.uSweepColor.value.set(sweep.color);
    this.uniforms.uSweepStrength.value = sweep.strength;
    this.uniforms.uReflection.value = reflection;
  }

  /**
   * @param elapsed Ambient-animation clock (frozen under reduced motion).
   * @param shown Seconds since the scene first appeared; `Infinity` skips the reveal.
   */
  update(elapsed: number, shown: number): void {
    const { lift, float, wave, reveal, sweep } = SOLAR_SCENE.wordmark;

    this.letters.position.y = lift + Math.sin(elapsed * float.speed) * float.amplitude;
    this.letters.rotation.x = Math.sin(elapsed * float.speed * 0.7) * float.tilt;
    this.letters.rotation.y = Math.sin(elapsed * float.speed * 0.45) * float.sway;
    this.reflectedLetters.position.copy(this.letters.position);
    this.reflectedLetters.rotation.copy(this.letters.rotation);

    this.glyphs.forEach((glyph, index) => {
      const progress = MathUtils.clamp(
        (shown - reveal.delay - index * reveal.stagger) / reveal.duration,
        0,
        1,
      );
      // From lying flat (face up, top away from the camera) to upright.
      glyph.rotation.x = -(Math.PI / 2) * (1 - easeOutBack(progress));
      glyph.position.y = Math.sin(elapsed * wave.speed - index * wave.lag) * wave.amplitude;
      this.reflections[index].position.y = glyph.position.y;
      this.reflections[index].rotation.x = glyph.rotation.x;
    });

    // The first pass follows the reveal; under reduced motion (`shown` is
    // Infinity) the band never runs.
    const pass = Number.isFinite(shown)
      ? ((shown - sweep.delay) % sweep.period) / sweep.duration
      : -1;
    this.uniforms.uSweep.value =
      pass >= 0 && pass < 1
        ? MathUtils.lerp(-this.sweepSpan, this.sweepSpan, MathUtils.smootherstep(pass, 0, 1))
        : SWEEP_PARKED;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.face.dispose();
    this.rim.dispose();
    this.reflectedFace.dispose();
    this.reflectedRim.dispose();
  }

  /**
   * Splices the light band into a material — plus the shading for
   * faces, the chamfer split for the rim, and the depth fade for the
   * mirrored copy.
   */
  private decorate(material: MeshPhysicalMaterial, part: 'face' | 'rim', reflected = false): void {
    const finish = part === 'rim' ? CHAMFER_FRAGMENT : FACE_FRAGMENT;
    const fade = reflected ? REFLECTION_FRAGMENT : '';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${WORDMARK_VERTEX_PARS}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${WORDMARK_VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${WORDMARK_FRAGMENT_PARS}`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${finish}`)
        .replace(
          '#include <opaque_fragment>',
          `${SWEEP_FRAGMENT}\n${fade}\n#include <opaque_fragment>`,
        );
    };
    // Every variant shares one onBeforeCompile source, so key them apart explicitly.
    material.customProgramCacheKey = () => `wordmark-${part}${reflected ? '-reflected' : ''}`;
  }
}

/** Ease-out with a small overshoot past the end value before settling on it. */
function easeOutBack(t: number): number {
  const c = REVEAL_OVERSHOOT;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
