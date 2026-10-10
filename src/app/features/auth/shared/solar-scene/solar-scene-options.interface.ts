import type { SceneFraming } from './scene-framing.interface';
import type { SceneTheme } from './scene-theme.type';

/** Construction options for {@link SolarScene}. */
export interface SolarSceneOptions {
  framing: SceneFraming;
  /** The app theme to light the scene for; changeable later with `setTheme`. */
  theme: SceneTheme;
  /** Device pixel ratio; the scene caps it for performance. */
  pixelRatio: number;
  /** Freezes ambient motion and the camera intro (prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Touch screens: vertical swipes scroll the page, horizontal ones rotate. */
  touchScroll: boolean;
  /** Validate and log shader compilation (development only; costs compile time). */
  checkShaders: boolean;
  /** Called once, after the first frame is on screen. */
  onFirstFrame: () => void;
  /** Called once, the first time the user rotates or zooms the scene. */
  onFirstInteraction: () => void;
}
