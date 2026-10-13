/**
 * Additions spliced into the panel face's MeshPhysicalMaterial (via
 * `onBeforeCompile`): an all-black monocrystalline module under glass —
 * square cells with clipped corners, faint busbars, the dark backsheet
 * between them, a fine metal frame round the edge — with the sky's light
 * lying across the glass and a band of sunlight that now and then runs over
 * it. Line widths follow the pixel size (`fwidth`), so the grid stays crisp
 * large and fades gracefully small.
 */

export const PANEL_VERTEX_PARS = /* glsl */ `
  varying vec2 vPanelUv;
  varying vec3 vPanelWorld;
`;

/** Runs after `project_vertex`. */
export const PANEL_VERTEX = /* glsl */ `
  vPanelUv = uv;
  vPanelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

export const PANEL_FRAGMENT_PARS = /* glsl */ `
  uniform vec2 uCells;
  uniform vec2 uFrame;
  uniform vec2 uBorder;
  uniform vec3 uCellColor;
  uniform vec3 uBusbarColor;
  uniform vec3 uBacksheetColor;
  uniform vec3 uFrameColor;
  uniform float uFrameMetalness;
  uniform float uFrameRoughness;
  uniform vec3 uSkyColor;
  uniform float uSkyStrength;
  uniform float uSweep;
  uniform vec3 uSweepOrigin;
  uniform vec3 uSweepColor;
  uniform float uSweepStrength;
  uniform float uSweepWidth;
  uniform float uSweepSlope;

  varying vec2 vPanelUv;
  varying vec3 vPanelWorld;
`;

/** Runs after `color_fragment`: frame, backsheet, cells and busbars. */
export const PANEL_COLOR_FRAGMENT = /* glsl */ `
  vec2 edge = min(vPanelUv, 1.0 - vPanelUv);
  float panelFrame = 1.0 - step(uFrame.x, edge.x) * step(uFrame.y, edge.y);

  vec2 field = (vPanelUv - uFrame - uBorder) / (1.0 - 2.0 * (uFrame + uBorder));
  vec2 grid = field * uCells;
  vec2 cell = fract(grid);
  vec2 toEdge = min(cell, 1.0 - cell);
  vec2 pixel = fwidth(grid);
  float detail = 1.0 - smoothstep(0.05, 0.16, max(pixel.x, pixel.y));

  vec2 gapWidth = max(vec2(0.022), pixel * 0.55);
  float gap = 1.0 - smoothstep(gapWidth.x, gapWidth.x + pixel.x, toEdge.x) *
    smoothstep(gapWidth.y, gapWidth.y + pixel.y, toEdge.y);
  float corner = 1.0 - smoothstep(0.1, 0.1 + pixel.x, toEdge.x + toEdge.y);
  float inField = step(0.0, field.x) * step(field.x, 1.0) * step(0.0, field.y) * step(field.y, 1.0);
  float backsheet = max(max(gap * mix(0.45, 0.9, detail), corner * mix(0.3, 0.85, detail)), 1.0 - inField);

  float busbar = 0.0;
  for (int i = 1; i <= 3; i++) {
    busbar = max(busbar, 1.0 - smoothstep(0.006, 0.006 + pixel.x, abs(cell.x - float(i) * 0.25)));
  }
  busbar *= detail * inField;

  float tone = fract(sin(dot(floor(grid), vec2(12.9898, 78.233))) * 43758.5453);
  vec3 module = mix(uCellColor * (0.93 + tone * 0.12), uBusbarColor, busbar * 0.65);
  module = mix(module, uBacksheetColor, backsheet);
  diffuseColor.rgb = mix(module, uFrameColor, panelFrame);
`;

/** Runs after `metalnessmap_fragment`: the frame band is metal, the glass is not. */
export const PANEL_FINISH_FRAGMENT = /* glsl */ `
  metalnessFactor = mix(metalnessFactor, uFrameMetalness, panelFrame);
  roughnessFactor = mix(roughnessFactor, uFrameRoughness, panelFrame);
`;

/**
 * Runs before `opaque_fragment`: the sky reflected in the glass (brighter
 * towards the top corner nearest the sun, as in a product photograph) and a
 * soft diagonal band of sunlight at `uSweep`.
 */
export const PANEL_SWEEP_FRAGMENT = /* glsl */ `
  float sky = smoothstep(0.1, 1.0, vPanelUv.y * 0.7 + vPanelUv.x * 0.3);
  outgoingLight += uSkyColor * sky * uSkyStrength * (1.0 - panelFrame);
  vec3 sweepLocal = vPanelWorld - uSweepOrigin;
  float sweepOffset = (sweepLocal.x + sweepLocal.y * uSweepSlope - uSweep) / uSweepWidth;
  outgoingLight += uSweepColor * exp(-sweepOffset * sweepOffset) * uSweepStrength * (1.0 - panelFrame * 0.5);
`;
