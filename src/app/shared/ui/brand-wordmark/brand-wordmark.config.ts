/**
 * The Ecotech logotype: one setting of the word, shared by every rendering of
 * it (the 2D lockup and the sign-in screens' 3D wordmark) so they match letter
 * for letter. Typeface: Archivo Expanded — a wide, quiet grotesque, set light
 * and open. Values are in em.
 */
export const BRAND_WORDMARK = {
  text: 'Ecotech',
  /**
   * Letter-spacing: small sizes want more air than large ones. Lower case
   * needs far less than capitals did, or the word falls apart into letters.
   */
  tracking: { small: 0.08, large: 0.04 },
  /**
   * Optical spacing on top of the font's kerning, per pair. The open side of
   * the E and both sides of the t read looser than two rounds meeting, so
   * those pairs close up a touch for an even rhythm.
   */
  optical: { Ec: -0.012, ot: -0.012, te: -0.012 },
} as const;
