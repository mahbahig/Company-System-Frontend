/**
 * The ECOTECH logotype: one setting of the word, shared by every rendering of
 * it (the 2D lockup and the sign-in screens' 3D wordmark) so they match letter
 * for letter. Typeface: Archivo Expanded — a wide, quiet grotesque, set light
 * and open. Values are in em.
 */
export const BRAND_WORDMARK = {
  text: 'ECOTECH',
  /** The product name set after the logotype in the lockup, in the same face. */
  descriptor: 'CRM',
  /**
   * Letter-spacing: small sizes want more air than large ones, and the
   * smaller, quieter descriptor more again.
   */
  tracking: { small: 0.2, large: 0.14, descriptor: 0.28 },
  /**
   * Optical spacing on top of the font's kerning, per pair. The open sides of
   * the T and two rounds meeting (C·O) read looser than the straight-sided
   * E and H, so those pairs close up a touch for an even rhythm.
   */
  optical: { CO: -0.012, OT: -0.016, TE: -0.024 },
} as const;
