/**
 * Where the scene's sun + wordmark lockup sits inside its canvas, so a layout
 * can keep it clear of the content around it. All values are fractions of the
 * canvas size.
 */
export interface SceneFraming {
  /** Vertical centre of the lockup, from the top (0.5 = middle). */
  centerY: number;
  /** Largest share of the canvas width the lockup may take. */
  fillWidth: number;
  /** Largest share of the canvas height the lockup may take. */
  fillHeight: number;
}
