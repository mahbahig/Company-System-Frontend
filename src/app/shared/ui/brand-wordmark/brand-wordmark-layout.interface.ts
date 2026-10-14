import type { BrandWordmarkLetter } from './brand-wordmark-letter.interface';

/** A word of the lockup set at one tracking; every measure in em. */
export interface BrandWordmarkLayout {
  readonly letters: readonly BrandWordmarkLetter[];
  /** Ink extent of the whole word: the first letter's left edge to the last's right. */
  readonly left: number;
  readonly right: number;
}
