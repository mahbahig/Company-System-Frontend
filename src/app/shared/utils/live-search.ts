import { effect, untracked } from '@angular/core';

/** How long typing must pause before a search or filter applies on its own. */
export const LIVE_SEARCH_DELAY_MS = 300;

/**
 * Live search: once what the user typed (`pending`) differs from what the list
 * shows (`applied`) and typing pauses for {@link LIVE_SEARCH_DELAY_MS}, `apply`
 * runs — no Search button. Each keystroke restarts the wait, and the wait is
 * dropped when the two agree again (the URL caught up, or the text was undone).
 * Call it in an injection context (it registers an effect).
 */
export function applyWhenTypingStops(pending: () => string, applied: () => string, apply: () => void): void {
  effect((onCleanup) => {
    if (pending() === applied()) return;
    const timer = setTimeout(() => untracked(apply), LIVE_SEARCH_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });
}
