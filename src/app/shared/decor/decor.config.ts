import { AdditiveBlending, NormalBlending } from 'three';

/**
 * Every tunable of the decorative three.js pieces in one place. They are
 * presentation only — nothing here knows about, or reacts to, CRM data.
 *
 * The view is always two world units tall (y from -1 to 1) at the focal
 * plane, whatever the canvas size, so sizes read as shares of the canvas
 * height. Angles are radians, durations seconds. Motion is deliberately slow:
 * the pieces should be felt more than watched, for hours at a time.
 */
export const DECOR = {
  renderer: {
    maxPixelRatio: 1.5,
    compactPixelRatio: 1.25,
    /** Motion this slow looks the same at 30 fps as at 60, for half the GPU work. */
    minFrameInterval: 1000 / 31,
    maxFrameDelta: 1 / 15,
  },

  /** Below this canvas width (CSS px) a piece takes its compact placement. */
  compactWidth: 600,

  camera: { fov: 26, near: 0.1, far: 30 },

  motion: {
    /** Clock everything is frozen at under reduced motion — a composed pose, the sunlight band parked. */
    restTime: 16,
    /** Pointer parallax (fine pointers only): largest tilt of the ribbons and motes, and its easing. */
    parallaxYaw: 0.05,
    parallaxPitch: 0.03,
    parallaxRate: 1.4,
    /** …and the solar array's lean towards the pointer, round its own centre. */
    lean: { yaw: 0.2, pitch: 0.12 },
    /** Fade-in of a freshly mounted piece, so it never pops in. */
    entrance: 2.4,
  },

  /**
   * The solar array: three all-black photovoltaic panels floating in a
   * staggered row — dark glass over monocrystalline cells, a fine
   * champagne-metal frame, the sky's light lying across the glass. The row
   * turns a little as if following a slow sun, each panel's tilt answering a
   * beat behind its neighbour, and now and then sunlight runs across the glass.
   */
  array: {
    /** One landscape module in its own units; ten by six cells, so each is square. */
    panel: { width: 1, height: 0.6, depth: 0.028 },
    cells: [10, 6],
    /** Metal frame and the backsheet border inside it, in panel units. */
    frame: 0.012,
    border: 0.01,
    /** Each panel: where it floats, how far it leans back towards the sky, how far it turns, and its beat. */
    panels: [
      { position: [-0.82, 0.34, -0.5], tilt: 0.62, turn: 0.34, phase: 0 },
      { position: [0, 0.03, 0], tilt: 0.56, turn: 0.22, phase: 0.9 },
      { position: [0.82, -0.3, 0.5], tilt: 0.5, turn: 0.1, phase: 1.8 },
    ],
    /** The row turns ±yaw over a long period; each tilt swings ±tilt, out of step. */
    track: { yaw: 0.12, yawSpeed: 0.05, tilt: 0.06, tiltSpeed: 0.17 },
    float: { amplitude: 0.022, speed: 0.3 },
    /** Sunlight crossing the glass: first at `delay`, then every `period`, taking `duration`. */
    sweep: { delay: 3, period: 9, duration: 2.6, width: 0.24, slope: 0.45 },
    /** The warm glow of the sun the panels face: behind them, towards the upper end. */
    glow: { position: [1.05, 0.95, -1.4], size: 4.6, breathSpeed: 0.35, breathAmount: 0.07 },
    /** Half-size of the whole piece in its own units — what the stage fits to the view. */
    extent: [1.55, 0.7],
    /** Height of the piece as a share of the view. */
    fill: 0.74,
    /** End-aligned: gap between the piece and the end edge, in world units. */
    endInset: 0.34,
    /** Compact canvases: a smaller piece by the top-end corner, partly cropped. */
    compact: { fill: 0.44, x: 0.42, y: 0.5 },
  },

  /** Silk ribbons of light: each turns along its length, so its width and sheen ebb and flow. */
  ribbons: {
    segments: 220,
    compactSegments: 120,
    /** Ribbons drawn on compact canvases (taken from the start of `bands`). */
    compactCount: 2,
    /** Extra length beyond the view on each side, so no ribbon end is ever seen. */
    overscan: 1.2,
    bands: [
      {
        y: 0,
        width: 0.17,
        amplitude: 0.2,
        wave: 0.85,
        speed: 0.1,
        twist: 1.2,
        depth: 0.25,
        phase: 0,
        opacity: 1,
      },
      {
        y: -0.16,
        width: 0.09,
        amplitude: 0.28,
        wave: 0.62,
        speed: -0.075,
        twist: 1.8,
        depth: 0.35,
        phase: 2.1,
        opacity: 0.7,
      },
      {
        y: 0.14,
        width: 0.055,
        amplitude: 0.16,
        wave: 1.15,
        speed: 0.065,
        twist: 2.4,
        depth: 0.2,
        phase: 4.2,
        opacity: 0.5,
      },
    ],
    /** A soft highlight gliding along each ribbon, once per period. */
    glintPeriod: 34,
  },

  motes: {
    count: 64,
    compactCount: 26,
    size: 30,
    seed: 1907,
    /** Depth range of the motes, behind and in front of the focal plane. */
    depth: [-1.4, 0.6],
  },

  /**
   * Which pieces each composition uses, where its ribbons run (y) and their
   * scale — waves are sized for a banner; a full page wants them finer.
   * `centerpiece`: the full piece for a hero band. `sculpture`: the solar
   * array alone. `ribbons`: a calm backdrop of light with no object.
   */
  compositions: {
    centerpiece: { array: true, ribbons: true, ribbonsY: -0.08, ribbonScale: 1, motes: 1 },
    sculpture: { array: true, ribbons: false, ribbonsY: 0, ribbonScale: 1, motes: 0.55 },
    ribbons: { array: false, ribbons: true, ribbonsY: -0.3, ribbonScale: 0.42, motes: 0.8 },
  },

  /**
   * Per theme. Light: dark glass panels on a pale surface, glows painted with
   * normal blending (added light would vanish). Dark: the glass catches warm
   * light and the ribbons add light to the night. Colours echo the app
   * palette: emerald-teal primary, solar-amber accent.
   */
  looks: {
    light: {
      blending: NormalBlending,
      exposure: 1,
      environment: 0.75,
      key: { color: 0xffffff, intensity: 2.2 },
      hemisphere: { sky: 0xffffff, ground: 0xefe4d2, intensity: 0.8 },
      glass: { metalness: 0.1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 },
      cells: { cell: 0x0b1522, busbar: 0x3b4654, backsheet: 0x253344 },
      frame: { color: 0xd8cdb6, metalness: 1, roughness: 0.28 },
      sky: { color: 0xdfe9f0, strength: 0.32 },
      glow: { color: 0xffc879, opacity: 0.34 },
      sweep: { color: 0xfff3d6, strength: 0.55 },
      ribbons: { from: 0x1f8a80, to: 0xc99a3e, opacity: 0.22 },
      motes: { warm: 0xc69a45, cool: 0xc69a45, opacity: 0.32 },
    },
    dark: {
      blending: AdditiveBlending,
      exposure: 1,
      environment: 0.55,
      key: { color: 0xfff1dc, intensity: 1.5 },
      hemisphere: { sky: 0x9fd8d2, ground: 0x0b1416, intensity: 0.45 },
      glass: { metalness: 0.1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 },
      cells: { cell: 0x0a1420, busbar: 0x334050, backsheet: 0x1f2c3b },
      frame: { color: 0xdcc9a0, metalness: 1, roughness: 0.26 },
      sky: { color: 0xffc98a, strength: 0.2 },
      glow: { color: 0xffa940, opacity: 0.3 },
      sweep: { color: 0xffe6b8, strength: 0.65 },
      ribbons: { from: 0x2db3a8, to: 0xf0b04a, opacity: 0.26 },
      motes: { warm: 0xffe2a8, cool: 0x7fd6cc, opacity: 0.7 },
    },
  },
} as const;
