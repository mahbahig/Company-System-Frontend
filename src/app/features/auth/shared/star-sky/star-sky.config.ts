import { AdditiveBlending, NormalBlending } from 'three';

/**
 * Every tunable of the sky behind the sign-in page: a still field of
 * twinkling stars with meteors streaking across it now and then. Distances
 * are CSS pixels, angles radians, durations seconds; each range is `[min, max]`
 * and a fresh value is drawn from it for every meteor.
 */
export const STAR_SKY = {
  renderer: {
    /** Stars are a pixel or two across, so beyond 1.5 extra pixels buy nothing. */
    maxPixelRatio: 1.5,
    minFrameInterval: 1000 / 61,
    maxFrameDelta: 1 / 20,
  },

  stars: {
    /** One star per this many square pixels, so any screen is equally dense. */
    area: 4200,
    max: 560,
    seed: 4211,
    /** Core diameter of an ordinary star. */
    size: [0.7, 1.9],
    /** Share of stars that are bright, with a soft cross of light, and their size. */
    brightShare: 0.035,
    brightSize: [1.8, 2.5],
    /** Share of stars in the warm colour rather than the cool one. */
    warmShare: 0.22,
    /** Twinkle clock the field is frozen at under reduced motion. */
    restTime: 9,
  },

  meteors: {
    /** Most meteors on screen at once. */
    pool: 6,
    firstDelay: [0.6, 1.6],
    /** Wait between one meteor and the next… */
    gap: [1.4, 3.8],
    /** …unless this chance comes up, and a second one follows close behind. */
    burstChance: 0.25,
    burstGap: [0.12, 0.45],
    speed: [650, 1300],
    life: [0.7, 1.4],
    tail: [150, 360],
    /** How steeply meteors fall below the horizontal, either way across. */
    dip: [0.28, 0.85],
    /** Thickness, as a multiple of the base streak. */
    scale: [0.75, 1.25],
    brightness: [0.55, 1],
    /** Share of meteors with a warm (gold) tail rather than a cool (petrol) one. */
    warmShare: 0.3,
  },

  /**
   * Per theme. Dark: pale stars and white-hot meteors that add light to the
   * petrol night. Light: the same sky in daylight, drawn in brand ink — petrol
   * and gold — since light added to a pale sky would vanish into it.
   */
  looks: {
    light: {
      blending: NormalBlending,
      stars: { cool: 0x0b7593, warm: 0xe39e00, opacity: 0.4, sparkle: 0 },
      meteors: { head: 0xd38f00, tailCool: 0x0a6a86, tailWarm: 0xf2a900, opacity: 0.85 },
    },
    dark: {
      blending: AdditiveBlending,
      stars: { cool: 0xbfe8f4, warm: 0xffe4a8, opacity: 0.95, sparkle: 0.6 },
      meteors: { head: 0xffffff, tailCool: 0x5fd0ea, tailWarm: 0xffc94a, opacity: 1 },
    },
  },
} as const;
