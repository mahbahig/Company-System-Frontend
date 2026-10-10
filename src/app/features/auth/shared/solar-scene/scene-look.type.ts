import type { SceneTheme } from './scene-theme.type';
import type { SOLAR_SCENE } from './solar-scene.config';

/** The lighting and materials the scene uses for one theme. */
export type SceneLook = (typeof SOLAR_SCENE.looks)[SceneTheme];
