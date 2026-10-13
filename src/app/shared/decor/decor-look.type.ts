import type { DECOR } from './decor.config';
import type { DecorTheme } from './decor-theme.type';

/** The lighting, colours and blending every decor piece uses for one theme. */
export type DecorLook = (typeof DECOR.looks)[DecorTheme];
