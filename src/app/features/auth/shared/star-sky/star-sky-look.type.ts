import type { SceneTheme } from '../solar-scene/scene-theme.type';
import type { STAR_SKY } from './star-sky.config';

/** The colours and blending the star sky uses for one theme. */
export type StarSkyLook = (typeof STAR_SKY.looks)[SceneTheme];
