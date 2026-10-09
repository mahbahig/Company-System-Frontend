/**
 * Page numbers to show around the current page, with `null` marking a gap:
 * pageWindow(7, 20) → [1, null, 5, 6, 7, 8, 9, null, 20]. Same as the Next app.
 */
export function pageWindow(page: number, pageCount: number, span = 2): (number | null)[] {
  if (pageCount <= 1) return [1];
  const pages = new Set<number>([1, pageCount]);
  for (let offset = -span; offset <= span; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= pageCount) pages.add(candidate);
  }
  const ordered = [...pages].sort((a, b) => a - b);
  const withGaps: (number | null)[] = [];
  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) withGaps.push(null);
    withGaps.push(value);
  });
  return withGaps;
}
