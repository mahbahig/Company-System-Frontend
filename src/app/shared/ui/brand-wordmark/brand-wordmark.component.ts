import { Component, computed, input } from '@angular/core';

import { BRAND_WORDMARK_GLYPHS } from './brand-wordmark-glyphs';
import { BRAND_WORDMARK } from './brand-wordmark.config';
import { layoutBrandWordmark } from './layout-brand-wordmark';

/**
 * The Ecotech logotype as inline SVG, drawn from the brand typeface's own
 * outlines (no web font to load, identical everywhere) in `currentColor`.
 *
 * Size it by height: the box is exactly the cap height, so `h-*` sets how tall
 * the E is and the width follows (the h's ascender and the round letters'
 * overshoot spill a hair past it, as in type). Decorative: give the
 * surrounding element an accessible name.
 */
@Component({
  selector: 'app-brand-wordmark',
  templateUrl: './brand-wordmark.component.html',
  host: { class: 'inline-block shrink-0' },
})
export class BrandWordmarkComponent {
  /** The word to set, from the logotype's letters. */
  readonly text = input<string>(BRAND_WORDMARK.text);
  /** Letter-spacing in em; the default suits the logotype at small sizes. */
  readonly tracking = input<number>(BRAND_WORDMARK.tracking.small);

  protected readonly em = BRAND_WORDMARK_GLYPHS.unitsPerEm;
  protected readonly layout = computed(() => layoutBrandWordmark(this.text(), this.tracking()));
  protected readonly viewBox = computed(() => {
    const { left, right } = this.layout();
    const { capHeight } = BRAND_WORDMARK_GLYPHS;
    return `${left * this.em} ${-capHeight} ${(right - left) * this.em} ${capHeight}`;
  });
}
