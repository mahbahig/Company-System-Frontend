import type { BrandWordmarkGlyph } from './brand-wordmark-glyph.interface';

/** A letter placed in the logotype. */
export interface BrandWordmarkLetter {
  readonly char: string;
  readonly glyph: BrandWordmarkGlyph;
  /** The letter's origin, in em from the first letter's. */
  readonly x: number;
}
