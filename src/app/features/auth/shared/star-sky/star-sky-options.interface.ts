import type { SceneTheme } from '../solar-scene/scene-theme.type';

/** Construction options for {@link StarSky}. */
export interface StarSkyOptions {
  /** The app theme to draw the sky for; changeable later with `setTheme`. */
  theme: SceneTheme;
  /** Device pixel ratio; the sky caps it for performance. */
  pixelRatio: number;
  /** Holds the stars still and sends no meteors (prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Validate and log shader compilation (development only; costs compile time). */
  checkShaders: boolean;
  /** Called once, after the first frame is on screen. */
  onFirstFrame: () => void;
}
