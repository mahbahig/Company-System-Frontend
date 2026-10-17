import type { BrandWordmarkGlyph } from './brand-wordmark-glyph.interface';
import { BRAND_WORDMARK_GLYPHS } from './brand-wordmark-glyphs';
import type { BrandWordmarkLayout } from './brand-wordmark-layout.interface';
import type { BrandWordmarkLetter } from './brand-wordmark-letter.interface';
import { BRAND_WORDMARK } from './brand-wordmark.config';

const glyphs: Readonly<Record<string, BrandWordmarkGlyph>> = BRAND_WORDMARK_GLYPHS.glyphs;
const kerning: Readonly<Record<string, number>> = BRAND_WORDMARK_GLYPHS.kerning;
const optical: Readonly<Record<string, number>> = BRAND_WORDMARK.optical;

/**
 * Sets `text` (the logotype's letters) at `tracking` em: each letter
 * after the first moves on by the previous advance, the tracking, the font's
 * kerning and the optical spacing for the pair.
 */
export function layoutBrandWordmark(text: string, tracking: number): BrandWordmarkLayout {
  const em = BRAND_WORDMARK_GLYPHS.unitsPerEm;
  const letters: BrandWordmarkLetter[] = [];
  let cursor = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (index > 0) {
      const pair = text.slice(index - 1, index + 1);
      cursor += tracking + (kerning[pair] ?? 0) / em + (optical[pair] ?? 0);
    }
    const glyph = glyphs[char];
    letters.push({ char, glyph, x: cursor });
    cursor += glyph.advance / em;
  }
  const first = letters[0];
  const last = letters[letters.length - 1];
  return {
    letters,
    left: first.x + first.glyph.left / em,
    right: last.x + last.glyph.right / em,
  };
}
