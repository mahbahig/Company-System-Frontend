import { AdditiveBlending, NormalBlending } from 'three';

/**
 * Every tunable of the sign-in solar scene in one place. Colours come from the
 * ECOTECH brand (ecotecheg.com: petrol #006584, solar yellow #ffd400); world
 * units are arbitrary because the camera is fitted to `composition`, so the
 * scene reads the same in a tall desktop panel and a short mobile hero.
 *
 * Angles are in radians, durations in seconds. The sun moves visibly on its
 * own (turning crown, churning surface, travelling flares) and a band of light
 * crosses the wordmark now and then; everything else stays calm so the scene
 * never competes with the form.
 */
export const SOLAR_SCENE = {
  /** The sun's own colours, shared by both looks. */
  palette: {
    sunHot: 0xfff6d8,
    sun: 0xffd400,
    sunDeep: 0xff8a1c,
    sunEmber: 0xd9500b,
    /** Warm white, not brand yellow: yellow light on petrol mixes to an off-brand lime. */
    sunLight: 0xffe2b8,
  },

  renderer: {
    /** Beyond ~1.75 the extra pixels are invisible here but cost real GPU time. */
    maxPixelRatio: 1.75,
    /** Ambient motion needs no more than 60 fps; caps high-refresh screens. */
    minFrameInterval: 1000 / 61,
    /** Longest step the animation takes after a stall (e.g. a background tab). */
    maxFrameDelta: 1 / 20,
  },

  /** Bounding box of the sun + wordmark lockup that the camera keeps in frame. */
  composition: {
    width: 4.2,
    height: 3.5,
    /** Orbit pivot: between the sun (behind) and the wordmark (in front). */
    target: [0, 0.14, -0.3],
  },

  camera: {
    fov: 30,
    near: 0.1,
    far: 60,
    /** Rest pose sits a touch above the horizon, so the wordmark's reflection reads. */
    homeElevation: 0.07,
  },

  controls: {
    dampingFactor: 0.065,
    rotateSpeed: 0.5,
    zoomSpeed: 0.55,
    /** Zoom range as multiples of the fitted distance. */
    minZoom: 0.8,
    maxZoom: 1.3,
    /** Left/right swing either side of the rest pose — the wordmark stays legible. */
    azimuthRange: 0.7,
    /** How far the camera may rise above / sink below the horizon. */
    polarRise: 0.42,
    polarDip: 0.2,
  },

  sun: {
    position: [0, 0.62, -1.5],
    radius: 1.08,
    /** Corona billboard half-width, in sun radii. */
    coronaExtent: 3.3,
    /** The crown's rays — the eighteen of the ECOTECH sun mark. */
    rays: 18,
    /** Surface rotation: about a turn a minute, so the plasma visibly travels. */
    spin: 0.1,
    /** Crown rotation — counter to the surface, so the two read as separate layers. */
    crownTurn: -0.07,
    /** A slow swell of the whole sun. */
    breath: { amplitude: 0.014, speed: 0.8 },
    light: { pulse: 0.06, pulseSpeed: 0.8 },
    segments: { width: 96, height: 64 },
  },

  /**
   * Taking hold of the sun: a drag on it turns it any way, as far as the user
   * likes; on release a spring brings it home, carrying the fling.
   */
  grip: {
    /** Hit area in sun radii — a little past the rim, so the edge is easy to catch. */
    reach: 1.12,
    /** Turn per sun radius dragged on screen (1 would keep the surface under the hand). */
    turnRate: 1.6,
    /**
     * The fling: velocity is smoothed over `smoothing` seconds, a hand held
     * still longer than `stillness` before letting go throws nothing, and the
     * spin is capped at `maxSpin` rad/s.
     */
    fling: { smoothing: 0.04, stillness: 0.09, maxSpin: 22 },
    /**
     * The way home: natural frequency (rad/s) and damping ratio — just under
     * critical, so it settles with the faintest overshoot. A gentle release
     * eases back; a flick past half a turn completes the revolution instead.
     */
    spring: { frequency: 3.8, damping: 0.72 },
  },

  wordmark: {
    text: 'ECOTECH',
    size: 0.44,
    /** Letter-spacing in em — generous tracking reads as a crafted logotype. */
    tracking: 0.34,
    depth: 0.13,
    /**
     * The bevel is inset (cut inside the glyph outline rather than added to
     * it), so the letters keep their weight and gain a fine gold chamfer.
     */
    bevel: { thickness: 0.018, size: 0.011, segments: 3 },
    curveSegments: 12,
    /** The floor line the letters stand on — also the mirror plane of their reflection. */
    floor: [0, -1.34, 0.5],
    /** Resting height of the baseline above the floor. */
    lift: 0.045,
    float: { amplitude: 0.022, speed: 0.55, tilt: 0.012, sway: 0.02 },
    /** A slow wave that runs through the letters one after another. */
    wave: { amplitude: 0.011, speed: 0.9, lag: 0.5 },
    /** On first show the letters stand up one by one, from lying flat. */
    reveal: { delay: 0.25, stagger: 0.09, duration: 1.2 },
    /** A band of light that glides across the letters every `period` seconds, from `delay`. */
    sweep: { delay: 2.3, period: 7, duration: 1.8, width: 0.11, slope: 0.6 },
    /** Height (world units) over which the reflection fades out below the floor. */
    reflectionFade: 0.26,
  },

  dust: {
    count: 170,
    innerRadius: 2.4,
    outerRadius: 6.4,
    height: 2.6,
    size: 58,
    seed: 2018,
  },

  /** Negative tilt brings each orbit's near arc below the sun's centre, as seen from just above. */
  orbits: [
    { radius: 1.75, tilt: -1.16, roll: 0.22, speed: 0.16, phase: 0.6, opacity: 0.34 },
    { radius: 2.1, tilt: -1.28, roll: -0.16, speed: -0.105, phase: 2.8, opacity: 0.24 },
  ],

  lighting: {
    key: { height: 3.6, depth: 6, sweepRadius: 4.2, sweepSpeed: 0.13 },
    rimPosition: [0, -3, -5],
  },

  motion: {
    /** Ambient-animation time the scene is frozen at under reduced motion. */
    restTime: 14,
    /** The camera eases in from a wider, angled pose when the scene first appears. */
    introZoom: 1.18,
    introAzimuth: 0.32,
    introRate: 1.3,
    /** After this long without input the camera drifts back to its rest pose. */
    idleReturnDelay: 3.5,
    returnRate: 0.9,
    /** Pointer parallax (fine pointers only): max rig rotation and its smoothing. */
    parallaxYaw: 0.06,
    parallaxPitch: 0.035,
    parallaxRate: 2.4,
  },

  /**
   * Per-theme lighting and materials. Light: a daylight stage — glows are
   * painted over the sky with normal blending (additive light would vanish
   * into it), and the letters are deep petrol lacquer with gold chamfers.
   * Dark: a petrol night — glows add light, and the letters are platinum.
   */
  looks: {
    light: {
      blending: NormalBlending,
      exposure: 1,
      environment: 1,
      key: { color: 0xffffff, intensity: 2.6 },
      rim: { color: 0xa9dcea, intensity: 0.8 },
      hemisphere: { sky: 0xe4f4f8, ground: 0xf3e6cc, intensity: 0.6 },
      sunLight: 14,
      corona: {
        inner: 0xffc61a,
        outer: 0xffa31f,
        rays: 0xffb100,
        glow: 0.85,
        haze: 0.26,
        rayStrength: 0.62,
        pulse: 0.2,
      },
      wordmark: {
        face: {
          color: 0x01506a,
          metalness: 0.1,
          roughness: 0.36,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
        },
        /** Face brightness at the baseline and at the cap line. */
        faceShade: [0.55, 1.2],
        chamfer: { color: 0xf7cf6c, metalness: 1, roughness: 0.18 },
        wall: { color: 0x01303f, metalness: 0.2, roughness: 0.5 },
        sweep: { color: 0xfff1cc, strength: 0.75 },
        reflection: 0.16,
      },
      dust: { warm: 0xf2a900, cool: 0x0b7593, opacity: 0.42 },
      orbits: { line: 0x0a6a86, glint: 0xffad00, glintCore: 0xfff3c4 },
    },
    dark: {
      blending: AdditiveBlending,
      exposure: 1,
      environment: 0.85,
      key: { color: 0xfff2dd, intensity: 2.1 },
      rim: { color: 0x37bfdc, intensity: 1.3 },
      hemisphere: { sky: 0x86cfe0, ground: 0x03141a, intensity: 0.5 },
      sunLight: 22,
      corona: {
        inner: 0xffd400,
        outer: 0xff8a1c,
        rays: 0xffc400,
        glow: 0.72,
        haze: 0.42,
        rayStrength: 0.3,
        pulse: 0.14,
      },
      wordmark: {
        face: {
          color: 0xf3f5f6,
          metalness: 0.55,
          roughness: 0.26,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        },
        faceShade: [0.78, 1.08],
        chamfer: { color: 0xf7cf6c, metalness: 1, roughness: 0.18 },
        wall: { color: 0x2b373c, metalness: 0.7, roughness: 0.4 },
        sweep: { color: 0xffffff, strength: 0.8 },
        reflection: 0.14,
      },
      dust: { warm: 0xfff6d8, cool: 0x37bfdc, opacity: 0.75 },
      orbits: { line: 0x37bfdc, glint: 0xffd400, glintCore: 0xffffff },
    },
  },
} as const;
