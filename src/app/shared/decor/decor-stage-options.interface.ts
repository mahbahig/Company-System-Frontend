import type { DecorAlign } from './decor-align.type';
import type { DecorComposition } from './decor-composition.type';
import type { DecorTheme } from './decor-theme.type';

/** Construction options for {@link DecorStage}. */
export interface DecorStageOptions {
  composition: DecorComposition;
  align: DecorAlign;
  /** Changeable later with `setTheme`. */
  theme: DecorTheme;
  /** Right-to-left layout: `end` alignment then means the left side. */
  rtl: boolean;
  /** Device pixel ratio; the stage caps it. */
  pixelRatio: number;
  /** Small or touch screens: fewer particles, ribbons and polygons, a lower pixel ratio. */
  compact: boolean;
  /** Holds everything still and renders only when something changes. */
  reducedMotion: boolean;
  /** Validate and log shader compilation (development only). */
  checkShaders: boolean;
  /** Called once, after the first frame is on screen. */
  onFirstFrame: () => void;
}
