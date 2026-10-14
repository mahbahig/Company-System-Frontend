import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';

export type ShortcutGroup = 'general' | 'navigation' | 'page';

/**
 * One keyboard shortcut. `keys` is a space-separated sequence of steps; a
 * step is a key, optionally prefixed with `mod+` (Ctrl on Windows / Linux,
 * ⌘ on macOS): `'mod+k'`, `'g c'`, `'n'`, `'?'`, `'['`.
 */
export interface Shortcut {
  id: string;
  keys: string;
  group: ShortcutGroup;
  /** Description for the shortcuts help (a function, so it follows the active language). */
  label: () => string;
  run: () => void;
  /** Fires while typing in a field — only ever for `mod+` combos (save, palette). */
  allowInInput?: boolean;
  /** Fires while a modal dialog is open (only the palette toggle does). */
  allowInDialog?: boolean;
}

const SEQUENCE_TIMEOUT_MS = 1200;

/**
 * The app's single keyboard-shortcut dispatcher.
 *
 * Shortcuts are REGISTERED by the UI that owns the action, at the moment that
 * UI is rendered: the shell registers navigation only for pages the role can
 * open, and a page's "New" button registers `n` only while that button is on
 * screen (i.e. only when the role may create). A shortcut therefore can never
 * do something the visible UI would not let the user do, and it runs the same
 * code path (it clicks the button / submits the form).
 *
 * Rules that keep shortcuts from surprising anyone: plain-letter shortcuts are
 * ignored while typing, with a modifier other than Shift, or while a dialog is
 * open; no shortcut is bound to a destructive action; browser shortcuts are
 * left alone except Ctrl/⌘+K (palette) and Ctrl/⌘+S on a form with Save.
 */
@Service()
export class KeyboardShortcuts {
  private readonly document = inject(DOCUMENT);
  private readonly registered = signal<Shortcut[]>([]);
  /** The shortcuts help dialog (`?`). */
  readonly helpOpen = signal(false);
  private pending: string[] = [];
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  /** What the help dialog lists (latest registration wins on a duplicate key). */
  readonly all = computed(() => {
    const byKeys = new Map<string, Shortcut>();
    for (const shortcut of this.registered()) byKeys.set(shortcut.keys, shortcut);
    return [...byKeys.values()];
  });

  readonly isMac = /Mac|iPhone|iPad/.test(this.document.defaultView?.navigator?.platform ?? '');

  constructor() {
    this.document.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  /** Adds a shortcut; returns the function that removes it. */
  register(shortcut: Shortcut): () => void {
    this.registered.update((list) => [...list.filter((existing) => existing.id !== shortcut.id), shortcut]);
    return () => this.registered.update((list) => list.filter((existing) => existing !== shortcut));
  }

  /** `mod+k` → `['Ctrl', 'K']` / `['⌘', 'K']`; `g c` → `['G', 'C']` (for <kbd> rendering). */
  display(keys: string): string[][] {
    return keys.split(' ').map((step) =>
      step.split('+').map((part) => {
        if (part === 'mod') return this.isMac ? '⌘' : 'Ctrl';
        if (part === 'shift') return 'Shift';
        return part.length === 1 ? part.toUpperCase() : part;
      }),
    );
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    const step = this.stepOf(event);
    if (!step) return;
    const editing = isEditable(event.target);
    const dialogOpen = !!this.document.querySelector('dialog[open]');
    const candidates = this.registered().filter(
      (shortcut) => (!editing || shortcut.allowInInput) && (!dialogOpen || shortcut.allowInDialog),
    );
    if (!candidates.length) return;

    const sequence = [...this.pending, step].join(' ');
    // Most recent registration wins (a page can refine a shell shortcut).
    const exact = [...candidates].reverse().find((shortcut) => shortcut.keys === sequence);
    if (exact) {
      event.preventDefault();
      this.resetSequence();
      exact.run();
      return;
    }
    if (candidates.some((shortcut) => shortcut.keys.startsWith(`${sequence} `))) {
      this.pending = sequence.split(' ');
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => this.resetSequence(), SEQUENCE_TIMEOUT_MS);
      return;
    }
    this.resetSequence();
  }

  /** Normalises a key press into a step (`'mod+k'`, `'g'`, `'?'`), or null for modifier-only / Alt combos. */
  private stepOf(event: KeyboardEvent): string | null {
    const key = event.key;
    if (!key || ['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'CapsLock'].includes(key)) return null;
    if (event.altKey) return null;
    const mod = this.isMac ? event.metaKey : event.ctrlKey;
    if ((this.isMac ? event.ctrlKey : event.metaKey) && !mod) return null;
    const name = key.length === 1 ? key.toLowerCase() : key;
    return mod ? `mod+${name}` : name;
  }

  private resetSequence(): void {
    this.pending = [];
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
}
