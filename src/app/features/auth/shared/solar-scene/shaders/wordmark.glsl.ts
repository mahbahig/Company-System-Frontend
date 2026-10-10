/**
 * Additions spliced into the wordmark's MeshPhysicalMaterial shaders (via
 * `onBeforeCompile`): a gold chamfer on otherwise plain letter walls, a
 * travelling band of light and, for the mirrored copy, a reflection that
 * fades out with depth below the floor.
 */

export const WORDMARK_VERTEX_PARS = /* glsl */ `
  varying vec3 vSweepPosition;
  varying float vGlyphHeight;
  varying float vFrontness;
`;

/** Runs after `project_vertex`, where `transformed` holds the object-space position. */
export const WORDMARK_VERTEX = /* glsl */ `
  vSweepPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vGlyphHeight = position.y;
  vFrontness = abs(normal.z);
`;

export const WORDMARK_FRAGMENT_PARS = /* glsl */ `
  uniform float uSweep;
  uniform vec3 uSweepColor;
  uniform float uSweepStrength;
  uniform float uSweepWidth;
  uniform float uSweepSlope;
  uniform vec3 uSweepOrigin;
  uniform float uReflection;
  uniform float uReflectionFade;
  uniform vec3 uWallColor;
  uniform float uWallMetalness;
  uniform float uWallRoughness;
  uniform vec2 uFaceShade;
  uniform float uCapHeight;

  varying vec3 vSweepPosition;
  varying float vGlyphHeight;
  varying float vFrontness;
`;

/**
 * For the walls-and-bevel material (whose own colour is the chamfer's): bevel
 * facets that still face forwards keep it, the walls take the wall finish —
 * so from the front each letter is traced by a fine gold line, not a gold slab.
 * Runs after `metalnessmap_fragment`.
 */
export const CHAMFER_FRAGMENT = /* glsl */ `
  float chamfer = smoothstep(0.15, 0.4, vFrontness);
  diffuseColor.rgb = mix(uWallColor, diffuseColor.rgb, chamfer);
  metalnessFactor = mix(uWallMetalness, metalnessFactor, chamfer);
  roughnessFactor = mix(uWallRoughness, roughnessFactor, chamfer);
`;

/**
 * For the faces: lacquer that deepens towards the baseline and lifts towards
 * the cap line, as if lit from above. Runs after `metalnessmap_fragment`.
 */
export const FACE_FRAGMENT = /* glsl */ `
  diffuseColor.rgb *= mix(uFaceShade.x, uFaceShade.y, clamp(vGlyphHeight / uCapHeight, 0.0, 1.0));
`;

/** A soft diagonal band of light at `uSweep`, measured from the floor origin. */
export const SWEEP_FRAGMENT = /* glsl */ `
  vec3 sweepLocal = vSweepPosition - uSweepOrigin;
  float sweepOffset = (sweepLocal.x + sweepLocal.y * uSweepSlope - uSweep) / uSweepWidth;
  outgoingLight += uSweepColor * exp(-sweepOffset * sweepOffset) * uSweepStrength;
`;

/** Strongest where a letter meets the floor, gone `uReflectionFade` below it. */
export const REFLECTION_FRAGMENT = /* glsl */ `
  diffuseColor.a *= uReflection * pow(1.0 - smoothstep(0.0, uReflectionFade, vGlyphHeight), 1.6);
`;
