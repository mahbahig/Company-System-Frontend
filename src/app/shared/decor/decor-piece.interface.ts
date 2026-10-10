import type { Object3D } from 'three';

import type { DecorLook } from './decor-look.type';

/** One element of a decor composition, driven by {@link DecorStage}. */
export interface DecorPiece {
  readonly object: Object3D;
  setLook(look: DecorLook): void;
  /** @param time Ambient clock in seconds (frozen under reduced motion). */
  update(time: number): void;
  /** Frees every GPU resource the piece created. */
  dispose(): void;
}
