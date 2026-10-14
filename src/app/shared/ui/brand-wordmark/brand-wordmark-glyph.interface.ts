/** One letter of the logotype, in font units on its em (see `BRAND_WORDMARK_GLYPHS`). */
export interface BrandWordmarkGlyph {
  readonly advance: number;
  /** Ink extent from the letter's origin. */
  readonly left: number;
  readonly right: number;
  /** SVG path data, y down, baseline at 0. */
  readonly path: string;
}
