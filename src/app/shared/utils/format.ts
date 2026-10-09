/**
 * Locale-independent display helpers (locale-aware ones live on I18nService).
 * Mirrors the Next app's src/lib/format.ts.
 */

/**
 * A phone number forced to LTR. Without the isolate marks (U+2066/U+2069) a
 * Latin-digit number inside Arabic text is reordered by the bidi algorithm.
 */
export function formatPhone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? `⁦${trimmed}⁩` : '';
}

/** True when a follow-up / due timestamp is in the past. */
export function isOverdue(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time < now;
}

/** Whole days since a timestamp, or null. */
export function daysSince(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.floor((now - time) / 86_400_000);
}
