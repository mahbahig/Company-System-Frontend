import type { DECOR } from './decor.config';

/** A named arrangement of decor pieces — see `DECOR.compositions`. */
export type DecorComposition = keyof typeof DECOR.compositions;
