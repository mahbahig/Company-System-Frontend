/** A piece of a message's text, marked when it is (part of) a matched word. */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

const char = (code: number): string => String.fromCharCode(code);
const TATWEEL = char(0x0640);
const FOLDS: Readonly<Record<string, string>> = {
  [char(0x0649)]: char(0x064a), // alef maksura -> yeh
  [char(0x0629)]: char(0x0647), // teh marbuta -> heh
  [char(0x0671)]: char(0x0627), // alef wasla -> alef
};
const ARTICLE = `${char(0x0627)}${char(0x0644)}`;
const WORD = /[\p{L}\p{N}]/u;

/** One character folded the way the server's search index folds text (case, accents, Arabic marks and letter variants, digits). */
function fold(source: string): string {
  let value = source.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
  if (value === TATWEEL) return '';
  value = FOLDS[value] ?? value;
  const code = value.charCodeAt(0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  return value;
}

/**
 * Marks, in a result's original text, the words the server matched — its
 * normalized `terms`, as word prefixes (an Arabic word also after its
 * article), whatever the diacritics or letter variants in the text. Plain
 * text pieces only (never HTML).
 */
export function highlightSegments(text: string | null, terms: readonly string[]): HighlightSegment[] {
  if (!text) return [];
  if (!terms.length) return [{ text, match: false }];
  // The folded text, and for each folded character the original range it came from.
  let folded = '';
  const origin: Array<[number, number]> = [];
  let offset = 0;
  for (const piece of Array.from(text)) {
    const out = fold(piece);
    for (const _ of out) origin.push([offset, offset + piece.length]);
    folded += out;
    offset += piece.length;
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    if (!term) continue;
    for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + 1)) {
      const before = at === 0 ? '' : folded[at - 1]!;
      const startsWord = !WORD.test(before) || (at >= 2 && folded.slice(at - 2, at) === ARTICLE && (at === 2 || !WORD.test(folded[at - 3]!)));
      if (!startsWord) continue;
      const from = origin[at]![0];
      const to = origin[at + term.length - 1]![1];
      for (let index = from; index < to; index += 1) marked[index] = true;
    }
  }
  const segments: HighlightSegment[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = segments.at(-1);
    if (last && last.match === marked[index]) last.text += text[index];
    else segments.push({ text: text[index]!, match: marked[index]! });
  }
  return segments;
}
